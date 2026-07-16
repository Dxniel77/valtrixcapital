import {
  createPublicClient,
  decodeEventLog,
  formatUnits,
  http,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { bsc, polygon } from "viem/chains";
import {
  EXPLORER_CHAIN_ID,
  resolveExplorerApiKey,
} from "@/lib/block-explorer/etherscan-v2";
import type { StakingNetwork } from "@/lib/staking/store";
import { getDepositAddress, getUsdtContract } from "@/lib/wallet/deposit-addresses";
import { USDT_DECIMALS } from "@/lib/wallet/usdt-transfer";

const RECEIPT_WAIT_MS = 90_000;
const RECEIPT_POLL_MS = 2_000;

const TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: false, name: "value", type: "uint256" },
  ],
} as const;

function rpcUrl(network: StakingNetwork): string {
  if (network === "BSC") {
    return (
      process.env.NEXT_PUBLIC_BSC_RPC?.trim() ||
      "https://bsc-dataseed.binance.org"
    );
  }
  return (
    process.env.NEXT_PUBLIC_POLYGON_RPC?.trim() ||
    "https://polygon-bor-rpc.publicnode.com"
  );
}

export interface VerifiedUsdtDeposit {
  amount: number;
  fromAddress: string;
  toAddress: string;
}

function publicClient(network: StakingNetwork) {
  const chain = network === "BSC" ? bsc : polygon;
  return createPublicClient({
    chain,
    transport: http(rpcUrl(network)),
  });
}

type ExplorerReceiptLog = {
  address?: string;
  data?: string;
  topics?: string[];
};

type ExplorerReceiptResult = {
  status?: string;
  blockNumber?: string;
  logs?: ExplorerReceiptLog[];
};

function parseVerifiedTransfer(
  receipt: TransactionReceipt,
  input: {
    network: StakingNetwork;
    expectedFrom: string;
    expectedTo: string;
  },
): VerifiedUsdtDeposit | null {
  const usdt = getUsdtContract(input.network).toLowerCase();
  const expectedFrom = input.expectedFrom.toLowerCase();
  const expectedTo = input.expectedTo.toLowerCase();
  const decimals = USDT_DECIMALS[input.network];

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdt) continue;
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_EVENT],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") continue;

      const from = String(decoded.args.from).toLowerCase();
      const to = String(decoded.args.to).toLowerCase();
      if (from !== expectedFrom || to !== expectedTo) continue;

      const value = decoded.args.value as bigint;
      const amount = Number(formatUnits(value, decimals));
      if (!Number.isFinite(amount) || amount <= 0) return null;

      return { amount, fromAddress: from, toAddress: to };
    } catch {
      continue;
    }
  }

  return null;
}

function explorerReceiptToViem(
  raw: ExplorerReceiptResult,
): TransactionReceipt | null {
  if (!raw.logs || raw.status !== "0x1") return null;

  return {
    status: "success",
    blockNumber: raw.blockNumber ? BigInt(raw.blockNumber) : 0n,
    logs: raw.logs.map((log) => ({
      address: (log.address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      data: (log.data ?? "0x") as `0x${string}`,
      topics: (log.topics ?? []) as [`0x${string}`, ...`0x${string}`[]] | [],
    })),
  } as TransactionReceipt;
}

async function fetchReceiptFromExplorer(
  network: StakingNetwork,
  txHash: string,
): Promise<TransactionReceipt | null> {
  const apiKey = resolveExplorerApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    chainid: String(EXPLORER_CHAIN_ID[network]),
    module: "proxy",
    action: "eth_getTransactionReceipt",
    txhash: txHash,
    apikey: apiKey,
  });

  try {
    const res = await fetch(
      `https://api.etherscan.io/v2/api?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: ExplorerReceiptResult | string };
    if (!data.result || typeof data.result === "string") return null;
    return explorerReceiptToViem(data.result);
  } catch {
    return null;
  }
}

async function fetchTransactionReceipt(
  network: StakingNetwork,
  txHash: string,
  waitForMining: boolean,
): Promise<TransactionReceipt | null> {
  const client = publicClient(network);
  const hash = txHash as Hash;

  try {
    if (waitForMining) {
      return await client.waitForTransactionReceipt({
        hash,
        timeout: RECEIPT_WAIT_MS,
        pollingInterval: RECEIPT_POLL_MS,
      });
    }
    const receipt = await client.getTransactionReceipt({ hash });
    return receipt ?? (await fetchReceiptFromExplorer(network, txHash));
  } catch {
    return fetchReceiptFromExplorer(network, txHash);
  }
}

export type OnChainTxOutcome = "success" | "reverted" | "pending";

/**
 * Coarse on-chain outcome of a transaction:
 * - `success`: mined and executed successfully
 * - `reverted`: mined but failed/reverted (definitive — safe to mark FAILED)
 * - `pending`: not yet mined, dropped, or receipt unavailable (keep waiting)
 */
export async function getTxOutcome(
  network: StakingNetwork,
  txHash: string,
): Promise<OnChainTxOutcome> {
  const client = publicClient(network);
  let receipt: TransactionReceipt | null = null;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as Hash });
  } catch {
    receipt = null;
  }
  if (!receipt) {
    receipt = await fetchReceiptFromExplorer(network, txHash);
  }
  if (!receipt) return "pending";
  return receipt.status === "success" ? "success" : "reverted";
}

/** On-chain confirmation count for a mined transaction (0 if unknown). */
export async function getTxConfirmationCount(
  network: StakingNetwork,
  txHash: string,
): Promise<number> {
  const client = publicClient(network);
  try {
    let receipt: TransactionReceipt | null = await client.getTransactionReceipt({
      hash: txHash as Hash,
    });
    if (!receipt) {
      receipt = await fetchReceiptFromExplorer(network, txHash);
    }
    if (!receipt || receipt.status !== "success") return 0;
    const head = await client.getBlockNumber();
    if (head < receipt.blockNumber) return 0;
    return Number(head - receipt.blockNumber + 1n);
  } catch {
    return 0;
  }
}

/** Confirms a USDT transfer to the treasury from the user's wallet. */
export async function verifyUsdtDepositTx(input: {
  network: StakingNetwork;
  txHash: string;
  expectedFrom: string;
  /** Poll until mined (default true). Set false for a single immediate check. */
  waitForMining?: boolean;
}): Promise<VerifiedUsdtDeposit | null> {
  const treasury = getDepositAddress(input.network);
  if (
    !treasury ||
    treasury.toLowerCase() === "0x0000000000000000000000000000000000000000"
  ) {
    return null;
  }

  const receipt = await fetchTransactionReceipt(
    input.network,
    input.txHash,
    input.waitForMining !== false,
  );
  if (!receipt || receipt.status !== "success") return null;

  return parseVerifiedTransfer(receipt, {
    network: input.network,
    expectedFrom: input.expectedFrom,
    expectedTo: treasury,
  });
}

/** Verifies an admin treasury pool load (USDT from admin wallet → treasury). */
export async function verifyAdminTreasuryDeposit(input: {
  network: StakingNetwork;
  txHash: string;
  expectedFrom: string;
  waitForMining?: boolean;
}): Promise<VerifiedUsdtDeposit | null> {
  return verifyUsdtDepositTx(input);
}
