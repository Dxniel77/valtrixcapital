import type { BotNetwork } from "./store";
import type { RecentChainTx } from "./explorer";

const NETWORK_RPC: Record<BotNetwork, string> = {
  BSC: process.env.NEXT_PUBLIC_BSC_RPC ?? "https://bsc-dataseed.binance.org",
  POLYGON:
    process.env.NEXT_PUBLIC_POLYGON_RPC ?? "https://polygon-bor-rpc.publicnode.com",
};

interface RpcBlock {
  timestamp: string;
  transactions: string[];
}

const RPC_TIMEOUT_MS = 6_000;

async function rpcCall<T>(rpc: string, method: string, params: unknown[]): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message ?? `RPC ${method} error`);
  return json.result as T;
}

/**
 * Pull recent transaction hashes from the latest blocks via public RPC.
 * Any confirmed on-chain tx shows a current timestamp on BscScan / PolygonScan.
 */
export async function fetchRecentTxsViaRpc(
  network: BotNetwork,
  maxAgeMs = 6 * 60 * 60 * 1000,
  limit = 40,
): Promise<RecentChainTx[]> {
  const rpc = NETWORK_RPC[network];
  const latestHex = await rpcCall<string>(rpc, "eth_blockNumber", []);
  const latest = parseInt(latestHex, 16);
  const cutoff = Date.now() - maxAgeMs;
  const seen = new Set<string>();
  const txs: RecentChainTx[] = [];

  const maxBlocks = network === "BSC" ? 120 : 180;
  const txsPerBlock = 4;

  for (let block = latest; block > latest - maxBlocks && txs.length < limit; block -= 1) {
    const blockHex = `0x${block.toString(16)}`;
    let blockData: RpcBlock;
    try {
      blockData = await rpcCall<RpcBlock>(rpc, "eth_getBlockByNumber", [blockHex, false]);
    } catch {
      continue;
    }

    const executedAt = parseInt(blockData.timestamp, 16) * 1000;
    if (executedAt < cutoff) break;

    for (const hash of blockData.transactions.slice(0, txsPerBlock)) {
      const normalized = hash.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      txs.push({ hash: normalized, executedAt });
      if (txs.length >= limit) break;
    }
  }

  return txs.sort((a, b) => b.executedAt - a.executedAt);
}
