const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const DEFAULT_LOG_RPCS = [
  "https://rpc-bsc.48.club",
  "https://bsc.rpc.blxrbdn.com",
  "https://bsc.publicnode.com",
];

const CHUNK_BLOCKS = 4999;
const MAX_BLOCKS = 400_000;
const CONCURRENCY = 6;
const CALL_TIMEOUT_MS = 10_000;
const HARD_DEADLINE_MS = 45_000;

export interface BscUsdtTransferLog {
  txHash: string;
  from: string;
  to: string;
  amount: number;
  blockNumber: number;
  timestamp: number;
}

function isDataseed(url: string): boolean {
  return /bsc-dataseed/i.test(url);
}

export function bscLogRpcUrls(): string[] {
  const extra = [
    process.env.BSC_LOGS_RPC?.trim(),
    process.env.BSC_RPC?.trim(),
  ].filter(
    (url): url is string =>
      typeof url === "string" && url.length > 0 && !isDataseed(url),
  );
  return [...new Set([...extra, ...DEFAULT_LOG_RPCS])];
}

function paddedAddressTopic(address: string): string {
  return `0x${address.replace(/^0x/i, "").toLowerCase().padStart(64, "0")}`;
}

function topicToAddress(topic: string | undefined): string {
  if (!topic) return "";
  return `0x${topic.slice(-40).toLowerCase()}`;
}

function amountFromData(data: string, decimals: number): number {
  try {
    const raw = BigInt(data);
    const scale = 10n ** BigInt(decimals);
    return Number(raw / scale) + Number(raw % scale) / Number(scale);
  } catch {
    return 0;
  }
}

async function rpcCall<T>(
  url: string,
  method: string,
  params: unknown[],
  timeoutMs = CALL_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const json = (await res.json()) as {
      result?: T;
      error?: { message?: string };
    };
    if (json.error) throw new Error(json.error.message ?? "RPC error");
    if (json.result === undefined) throw new Error("RPC empty result");
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

async function rpcCallWithFailover<T>(
  urls: string[],
  method: string,
  params: unknown[],
  preferredIndex = 0,
): Promise<T> {
  const ordered = [
    urls[preferredIndex % urls.length],
    ...urls.filter((_, i) => i !== preferredIndex % urls.length),
  ].filter((url): url is string => Boolean(url));
  let lastError: unknown;
  for (const url of ordered) {
    try {
      return await rpcCall<T>(url, method, params);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All BSC RPCs failed");
}

interface RpcLog {
  transactionHash?: string;
  data?: string;
  topics?: string[];
  blockNumber?: string;
}

export async function fetchBscOfficialUsdtOutflows(input: {
  wallet: string;
  usdtContract: string;
  decimals: number;
  minAmount: number;
}): Promise<{
  items: BscUsdtTransferLog[];
  fromBlock: number;
  toBlock: number;
  lookbackHours: number;
  truncated: boolean;
  source: "rpc";
}> {
  const urls = bscLogRpcUrls();
  const wallet = input.wallet.toLowerCase();
  const contract = input.usdtContract.toLowerCase();
  const fromTopic = paddedAddressTopic(wallet);

  const latestHex = await rpcCallWithFailover<string>(urls, "eth_blockNumber", []);
  const latestBlock = parseInt(latestHex, 16);
  const latestHeader = await rpcCallWithFailover<{ timestamp: string }>(
    urls,
    "eth_getBlockByNumber",
    [latestHex, false],
  );
  const latestTs = parseInt(latestHeader.timestamp, 16) * 1000;
  const olderHex = `0x${Math.max(0, latestBlock - 2000).toString(16)}`;
  const olderHeader = await rpcCallWithFailover<{ timestamp: string }>(
    urls,
    "eth_getBlockByNumber",
    [olderHex, false],
  );
  const olderTs = parseInt(olderHeader.timestamp, 16) * 1000;
  const msPerBlock = Math.max(300, ((latestTs - olderTs) / 2000) || 450);

  const fromBlock = Math.max(0, latestBlock - MAX_BLOCKS);
  const ranges: Array<[number, number]> = [];
  for (let to = latestBlock; to > fromBlock; to -= CHUNK_BLOCKS) {
    ranges.push([Math.max(fromBlock, to - CHUNK_BLOCKS + 1), to]);
  }

  const started = Date.now();
  const logs: RpcLog[] = [];
  let next = 0;
  let truncated = false;
  let scannedFromBlock = latestBlock;
  let okChunks = 0;
  let failedChunks = 0;

  async function worker(workerIndex: number) {
    while (true) {
      const elapsed = Date.now() - started;
      if (elapsed >= HARD_DEADLINE_MS) {
        truncated = true;
        return;
      }
      const i = next++;
      if (i >= ranges.length) return;
      const [from, to] = ranges[i]!;
      try {
        const rows = await rpcCallWithFailover<RpcLog[]>(
          urls,
          "eth_getLogs",
          [
            {
              fromBlock: `0x${from.toString(16)}`,
              toBlock: `0x${to.toString(16)}`,
              address: contract,
              topics: [TRANSFER_TOPIC, fromTopic],
            },
          ],
          workerIndex + i,
        );
        if (Array.isArray(rows) && rows.length > 0) logs.push(...rows);
        scannedFromBlock = Math.min(scannedFromBlock, from);
        okChunks += 1;
      } catch {
        failedChunks += 1;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, ranges.length) }, (_, i) =>
      worker(i),
    ),
  );

  if (okChunks === 0 && failedChunks > 0) {
    throw new Error("BSC RPC getLogs failed on every chunk");
  }

  const seen = new Set<string>();
  const items: BscUsdtTransferLog[] = [];
  for (const log of logs) {
    const txHash = (log.transactionHash ?? "").toLowerCase();
    if (!txHash.startsWith("0x") || seen.has(txHash)) continue;
    const to = topicToAddress(log.topics?.[2]);
    const from = topicToAddress(log.topics?.[1]) || wallet;
    if (!to || to === from) continue;
    const amount = amountFromData(log.data ?? "0x0", input.decimals);
    if (amount < input.minAmount) continue;
    const blockNumber = parseInt(log.blockNumber ?? "0x0", 16);
    if (!Number.isFinite(blockNumber)) continue;
    seen.add(txHash);
    items.push({
      txHash,
      from,
      to,
      amount,
      blockNumber,
      timestamp: latestTs - (latestBlock - blockNumber) * msPerBlock,
    });
  }

  const uniqueBlocks = [...new Set(items.map((item) => item.blockNumber))];
  const blockTs = new Map<number, number>();
  await Promise.all(
    uniqueBlocks.map(async (blockNumber) => {
      try {
        const block = await rpcCallWithFailover<{ timestamp: string }>(
          urls,
          "eth_getBlockByNumber",
          [`0x${blockNumber.toString(16)}`, false],
        );
        blockTs.set(blockNumber, parseInt(block.timestamp, 16) * 1000);
      } catch {
        /* keep estimate */
      }
    }),
  );
  for (const item of items) {
    const exact = blockTs.get(item.blockNumber);
    if (exact) item.timestamp = exact;
  }

  items.sort((a, b) => b.blockNumber - a.blockNumber);
  const lookbackHours =
    ((latestBlock - scannedFromBlock) * msPerBlock) / (60 * 60 * 1000);

  return {
    items,
    fromBlock: scannedFromBlock,
    toBlock: latestBlock,
    lookbackHours,
    truncated,
    source: "rpc",
  };
}
