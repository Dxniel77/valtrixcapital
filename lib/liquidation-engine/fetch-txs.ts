import type {
  LiquidationChainTx,
  LiquidationNetwork,
} from "@/lib/liquidation-engine/types";
import { fetchRecentTxsViaRpc } from "@/lib/bot/chain-txs";
import {
  fetchExplorerTokenTxs,
  resolveExplorerApiKey,
  type ExplorerChain,
} from "@/lib/block-explorer/etherscan-v2";

const CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_TX_AGE_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6_000;

/** fetch() that aborts after a timeout so a hung upstream can't hold the connection. */
async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";
const POLYGON_USDT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
const BSC_ACTIVITY_ADDRESS = "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3";
const POLYGON_ACTIVITY_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const NETWORK_CONFIG: Record<
  LiquidationNetwork,
  {
    contract: string;
    address: string;
    decimals: number;
    rpc: string;
  }
> = {
  BSC: {
    contract: BSC_USDT,
    address: BSC_ACTIVITY_ADDRESS,
    decimals: 18,
    rpc: process.env.NEXT_PUBLIC_BSC_RPC ?? "https://bsc-dataseed.binance.org",
  },
  POLYGON: {
    contract: POLYGON_USDT,
    address: POLYGON_ACTIVITY_ADDRESS,
    decimals: 6,
    rpc:
      process.env.NEXT_PUBLIC_POLYGON_RPC ??
      "https://polygon-bor-rpc.publicnode.com",
  },
};

let cache: {
  at: number;
  BSC: LiquidationChainTx[];
  POLYGON: LiquidationChainTx[];
} | null = null;

function parseTokenAmount(value: string, decimals: number): number {
  const raw = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const frac = raw % scale;
  return Number(whole) + Number(frac) / Number(scale);
}

function isSmallSettlement(amountUsdt: number): boolean {
  return amountUsdt >= 0.5 && amountUsdt <= 25_000;
}

async function fetchViaExplorerApi(
  network: LiquidationNetwork,
): Promise<LiquidationChainTx[]> {
  const cfg = NETWORK_CONFIG[network];
  if (!resolveExplorerApiKey()) return [];

  const rows = await fetchExplorerTokenTxs(network as ExplorerChain, {
    contractAddress: cfg.contract,
    address: cfg.address,
    offset: 80,
    fetch: fetchWithTimeout,
  });
  if (rows.length === 0) return [];

  const cutoff = Date.now() - MAX_TX_AGE_MS;
  const seen = new Set<string>();
  const txs: LiquidationChainTx[] = [];

  for (const row of rows) {
    const hash = row.hash?.toLowerCase();
    const ts = Number(row.timeStamp) * 1000;
    const decimals = Number(row.tokenDecimal ?? cfg.decimals);
    const amountUsdt = parseTokenAmount(row.value ?? "0", decimals);
    if (!hash || !Number.isFinite(ts) || ts < cutoff) continue;
    if (!isSmallSettlement(amountUsdt)) continue;
    if (seen.has(hash)) continue;
    seen.add(hash);
    txs.push({ hash, executedAt: ts, amountUsdt, network });
    if (txs.length >= 50) break;
  }

  return txs;
}

interface RpcLog {
  transactionHash: string;
  data: string;
  blockNumber: string;
}

async function rpcCall<T>(
  rpc: string,
  method: string,
  params: unknown[],
): Promise<T> {
  const res = await fetchWithTimeout(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
  const json = (await res.json()) as {
    result?: T;
    error?: { message?: string };
  };
  if (json.error) throw new Error(json.error.message ?? `RPC ${method} error`);
  return json.result as T;
}

async function fetchUsdtTransfersViaLogs(
  network: LiquidationNetwork,
  limit = 40,
): Promise<LiquidationChainTx[]> {
  const cfg = NETWORK_CONFIG[network];
  const latestHex = await rpcCall<string>(cfg.rpc, "eth_blockNumber", []);
  const latest = parseInt(latestHex, 16);
  const fromBlock = Math.max(0, latest - (network === "BSC" ? 400 : 600));
  const cutoff = Date.now() - MAX_TX_AGE_MS;

  let logs: RpcLog[];
  try {
    logs = await rpcCall<RpcLog[]>(cfg.rpc, "eth_getLogs", [
      {
        fromBlock: `0x${fromBlock.toString(16)}`,
        toBlock: "latest",
        address: cfg.contract,
        topics: [TRANSFER_TOPIC],
      },
    ]);
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const blockTsCache = new Map<string, number>();
  const txs: LiquidationChainTx[] = [];

  async function blockTimestamp(blockNumber: string): Promise<number> {
    const cached = blockTsCache.get(blockNumber);
    if (cached !== undefined) return cached;
    const block = await rpcCall<{ timestamp: string }>(
      cfg.rpc,
      "eth_getBlockByNumber",
      [blockNumber, false],
    );
    const ts = parseInt(block.timestamp, 16) * 1000;
    blockTsCache.set(blockNumber, ts);
    return ts;
  }

  for (let i = logs.length - 1; i >= 0 && txs.length < limit; i -= 1) {
    const log = logs[i]!;
    const hash = log.transactionHash.toLowerCase();
    if (seen.has(hash)) continue;

    let blockTs = 0;
    try {
      blockTs = await blockTimestamp(log.blockNumber);
    } catch {
      continue;
    }
    if (blockTs < cutoff) continue;

    const amountUsdt = parseTokenAmount(log.data, cfg.decimals);
    if (!isSmallSettlement(amountUsdt)) continue;

    seen.add(hash);
    txs.push({
      hash,
      executedAt: blockTs,
      amountUsdt,
      network,
    });
  }

  return txs.sort((a, b) => b.executedAt - a.executedAt);
}

async function enrichRpcHashesWithAmounts(
  network: LiquidationNetwork,
  hashes: { hash: string; executedAt: number }[],
): Promise<LiquidationChainTx[]> {
  const cfg = NETWORK_CONFIG[network];

  const results = await Promise.all(
    hashes.slice(0, 20).map(async (item) => {
      try {
        const receipt = await rpcCall<{ logs: RpcLog[] }>(
          cfg.rpc,
          "eth_getTransactionReceipt",
          [item.hash],
        );
        const usdtLog = receipt.logs.find(
          (l) => l.data && l.data !== "0x" && l.transactionHash === item.hash,
        );
        if (!usdtLog?.data) return null;
        const amountUsdt = parseTokenAmount(usdtLog.data, cfg.decimals);
        if (!isSmallSettlement(amountUsdt)) return null;
        return {
          hash: item.hash,
          executedAt: item.executedAt,
          amountUsdt,
          network,
        } satisfies LiquidationChainTx;
      } catch {
        return null;
      }
    }),
  );

  return results.filter((tx): tx is LiquidationChainTx => tx !== null);
}

function hasExplorerApiKey(): boolean {
  return Boolean(resolveExplorerApiKey());
}

async function fetchNetworkTxs(
  network: LiquidationNetwork,
  options: { allowSlowFallback?: boolean } = {},
): Promise<LiquidationChainTx[]> {
  const { allowSlowFallback = true } = options;

  if (hasExplorerApiKey()) {
    const viaApi = await fetchViaExplorerApi(network);
    if (viaApi.length > 0) return viaApi;
  }

  if (!allowSlowFallback) return [];

  const viaLogs = await fetchUsdtTransfersViaLogs(network);
  if (viaLogs.length > 0) return viaLogs;

  try {
    const raw = await fetchRecentTxsViaRpc(network, MAX_TX_AGE_MS, 15);
    return enrichRpcHashesWithAmounts(network, raw);
  } catch {
    return [];
  }
}

type TxCache = {
  at: number;
  BSC: LiquidationChainTx[];
  POLYGON: LiquidationChainTx[];
};

let refreshInFlight: Promise<unknown> | null = null;

async function refreshCache(options?: {
  allowSlowFallback?: boolean;
}): Promise<TxCache> {
  const [BSC, POLYGON] = await Promise.all([
    fetchNetworkTxs("BSC", options),
    fetchNetworkTxs("POLYGON", options),
  ]);
  cache = { at: Date.now(), BSC, POLYGON };
  return cache;
}

function triggerBackgroundRefresh(): void {
  if (refreshInFlight) return;
  refreshInFlight = refreshCache({ allowSlowFallback: true })
    .catch(() => undefined)
    .finally(() => {
      refreshInFlight = null;
    });
}

/** Kick off a background fetch (e.g. on server cold start). */
export function warmLiquidationTxCache(): void {
  triggerBackgroundRefresh();
}

export async function fetchLiquidationChainTxs(): Promise<{
  BSC: LiquidationChainTx[];
  POLYGON: LiquidationChainTx[];
  fetchedAt: number;
}> {
  const now = Date.now();

  // Fresh cache — serve immediately.
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return { BSC: cache.BSC, POLYGON: cache.POLYGON, fetchedAt: cache.at };
  }

  // Stale or cold cache — never block the HTTP response on slow RPC fallbacks.
  // Return what we have (or empty) and refresh in the background.
  triggerBackgroundRefresh();
  return {
    BSC: cache?.BSC ?? [],
    POLYGON: cache?.POLYGON ?? [],
    fetchedAt: cache?.at ?? now,
  };
}
