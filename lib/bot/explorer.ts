import type { BotNetwork } from "./store";
import { fetchRecentTxsViaRpc } from "./chain-txs";

export interface RecentChainTx {
  hash: string;
  executedAt: number;
}

interface ExplorerTxResult {
  hash: string;
  timeStamp: string;
}

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

const NETWORK_CONFIG: Record<
  BotNetwork,
  { apiBase: string; apiKeyEnv: string; contract: string; address: string }
> = {
  BSC: {
    apiBase: "https://api.bscscan.com/api",
    apiKeyEnv: "BSCSCAN_API_KEY",
    contract: BSC_USDT,
    address: BSC_ACTIVITY_ADDRESS,
  },
  POLYGON: {
    apiBase: "https://api.polygonscan.com/api",
    apiKeyEnv: "POLYGONSCAN_API_KEY",
    contract: POLYGON_USDT,
    address: POLYGON_ACTIVITY_ADDRESS,
  },
};

let cache: {
  at: number;
  BSC: RecentChainTx[];
  POLYGON: RecentChainTx[];
} | null = null;

async function fetchViaExplorerApi(network: BotNetwork): Promise<RecentChainTx[]> {
  const cfg = NETWORK_CONFIG[network];
  const apiKey = process.env[cfg.apiKeyEnv]?.trim();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    module: "account",
    action: "tokentx",
    contractaddress: cfg.contract,
    address: cfg.address,
    page: "1",
    offset: "50",
    sort: "desc",
    apikey: apiKey,
  });

  let res: Response;
  try {
    res = await fetchWithTimeout(`${cfg.apiBase}?${params.toString()}`, {
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const data = (await res.json()) as {
    status?: string;
    result?: ExplorerTxResult[] | string;
  };
  if (data.status !== "1" || !Array.isArray(data.result)) return [];

  const cutoff = Date.now() - MAX_TX_AGE_MS;
  const seen = new Set<string>();
  const txs: RecentChainTx[] = [];

  for (const row of data.result) {
    const hash = row.hash?.toLowerCase();
    const ts = Number(row.timeStamp) * 1000;
    if (!hash || !Number.isFinite(ts) || ts < cutoff) continue;
    if (seen.has(hash)) continue;
    seen.add(hash);
    txs.push({ hash, executedAt: ts });
    if (txs.length >= 40) break;
  }

  return txs;
}

async function fetchNetworkTxs(network: BotNetwork): Promise<RecentChainTx[]> {
  try {
    const viaRpc = await fetchRecentTxsViaRpc(network, MAX_TX_AGE_MS, 40);
    if (viaRpc.length > 0) return viaRpc;
  } catch {
    // fall through to explorer API
  }

  const viaApi = await fetchViaExplorerApi(network);
  return viaApi;
}

type TxCache = {
  at: number;
  BSC: RecentChainTx[];
  POLYGON: RecentChainTx[];
};

let refreshInFlight: Promise<unknown> | null = null;

async function refreshCache(): Promise<TxCache> {
  const [BSC, POLYGON] = await Promise.all([
    fetchNetworkTxs("BSC"),
    fetchNetworkTxs("POLYGON"),
  ]);
  cache = { at: Date.now(), BSC, POLYGON };
  return cache;
}

function triggerBackgroundRefresh(): void {
  if (refreshInFlight) return;
  refreshInFlight = refreshCache()
    .catch(() => undefined)
    .finally(() => {
      refreshInFlight = null;
    });
}

export async function fetchRecentChainTxs(): Promise<{
  BSC: RecentChainTx[];
  POLYGON: RecentChainTx[];
  fetchedAt: number;
}> {
  const now = Date.now();

  // Fresh cache — serve immediately.
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return { BSC: cache.BSC, POLYGON: cache.POLYGON, fetchedAt: cache.at };
  }

  // Stale cache — serve stale instantly and refresh in the background so the
  // request never waits on slow external explorer/RPC calls.
  if (cache) {
    triggerBackgroundRefresh();
    return { BSC: cache.BSC, POLYGON: cache.POLYGON, fetchedAt: cache.at };
  }

  // Cold start — await once (bounded by per-fetch timeouts).
  const fresh = await refreshCache();
  return { BSC: fresh.BSC, POLYGON: fresh.POLYGON, fetchedAt: fresh.at };
}
