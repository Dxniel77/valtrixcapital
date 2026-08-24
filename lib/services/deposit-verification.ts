import {
  createPublicClient,
  decodeEventLog,
  decodeFunctionData,
  formatUnits,
  http,
  type Hash,
  type Transaction,
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

const RECEIPT_WAIT_MS = 8_000;
const RECEIPT_POLL_MS = 1_000;
const RPC_TIMEOUT_MS = 6_000;

const TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: false, name: "value", type: "uint256" },
  ],
} as const;

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function rpcUrls(network: StakingNetwork): string[] {
  if (network === "BSC") {
    return unique([
      process.env.NEXT_PUBLIC_BSC_RPC?.trim(),
      "https://bsc-dataseed.binance.org",
      "https://bsc-dataseed1.defibit.io",
    ]);
  }
  return unique([
    process.env.NEXT_PUBLIC_POLYGON_RPC?.trim(),
    "https://polygon-bor-rpc.publicnode.com",
    "https://polygon-rpc.com",
    "https://1rpc.io/matic",
  ]);
}

function unique(urls: Array<string | undefined>): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

function shortAddr(value: string): string {
  const v = value.toLowerCase();
  if (v.length < 12) return v;
  return `${v.slice(0, 8)}…${v.slice(-4)}`;
}

export interface VerifiedUsdtDeposit {
  amount: number;
  fromAddress: string;
  toAddress: string;
}

export type DepositVerifyFailureCode =
  | "TX_NOT_FOUND"
  | "TX_REVERTED"
  | "TX_WRONG_TOKEN"
  | "TX_WRONG_TREASURY";

export type DepositVerifyResult =
  | { ok: true; deposit: VerifiedUsdtDeposit; mined: boolean }
  | {
      ok: false;
      code: DepositVerifyFailureCode;
      message: string;
      sentTo?: string;
      expectedTo?: string;
    };

function publicClient(network: StakingNetwork, url?: string) {
  const chain = network === "BSC" ? bsc : polygon;
  return createPublicClient({
    chain,
    transport: http(url ?? rpcUrls(network)[0], { timeout: RPC_TIMEOUT_MS }),
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
    expectedFrom?: string;
    expectedTo: string;
  },
): VerifiedUsdtDeposit | null {
  const usdt = getUsdtContract(input.network).toLowerCase();
  const expectedFrom = input.expectedFrom?.toLowerCase() || null;
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
      if (to !== expectedTo) continue;
      if (expectedFrom && from !== expectedFrom) continue;

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

function parseAnyUsdtTransfer(
  receipt: TransactionReceipt,
  network: StakingNetwork,
): VerifiedUsdtDeposit | null {
  const usdt = getUsdtContract(network).toLowerCase();
  const decimals = USDT_DECIMALS[network];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdt) continue;
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_EVENT],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") continue;
      const amount = Number(formatUnits(decoded.args.value as bigint, decimals));
      if (!Number.isFinite(amount) || amount <= 0) continue;
      return {
        amount,
        fromAddress: String(decoded.args.from).toLowerCase(),
        toAddress: String(decoded.args.to).toLowerCase(),
      };
    } catch {
      continue;
    }
  }
  return null;
}

function decodeTransferCall(
  tx: Pick<Transaction, "to" | "input" | "from">,
  network: StakingNetwork,
): VerifiedUsdtDeposit | null {
  const usdt = getUsdtContract(network).toLowerCase();
  if (!tx.to || tx.to.toLowerCase() !== usdt) return null;
  try {
    const decoded = decodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      data: tx.input,
    });
    if (decoded.functionName !== "transfer") return null;
    const [to, amountRaw] = decoded.args;
    const amount = Number(formatUnits(amountRaw, USDT_DECIMALS[network]));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return {
      amount,
      fromAddress: tx.from.toLowerCase(),
      toAddress: String(to).toLowerCase(),
    };
  } catch {
    return null;
  }
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

async function firstResolved<T>(tasks: Array<Promise<T | null>>): Promise<T | null> {
  const wrapped = tasks.map(
    (task) =>
      new Promise<T>((resolve, reject) => {
        void task.then((value) => {
          if (value) resolve(value);
          else reject(new Error("empty"));
        }, reject);
      }),
  );
  try {
    return await Promise.any(wrapped);
  } catch {
    return null;
  }
}

async function fetchTransactionReceipt(
  network: StakingNetwork,
  txHash: string,
  waitForMining: boolean,
): Promise<TransactionReceipt | null> {
  const hash = txHash as Hash;
  const urls = rpcUrls(network);

  const fromRpcs = firstResolved(
    urls.map(async (url) => {
      const client = publicClient(network, url);
      try {
        try {
          const existing = await client.getTransactionReceipt({ hash });
          if (existing) return existing;
        } catch {
          /* not mined yet */
        }
        if (!waitForMining) return null;
        return await client.waitForTransactionReceipt({
          hash,
          timeout: RECEIPT_WAIT_MS,
          pollingInterval: RECEIPT_POLL_MS,
        });
      } catch {
        return null;
      }
    }),
  );

  const receipt = await fromRpcs;
  if (receipt) return receipt;
  return fetchReceiptFromExplorer(network, txHash);
}

async function fetchTransaction(
  network: StakingNetwork,
  txHash: string,
): Promise<Transaction | null> {
  const hash = txHash as Hash;
  return firstResolved(
    rpcUrls(network).map(async (url) => {
      try {
        return await publicClient(network, url).getTransaction({ hash });
      } catch {
        return null;
      }
    }),
  );
}

export type OnChainTxOutcome = "success" | "reverted" | "pending";

export async function getTxOutcome(
  network: StakingNetwork,
  txHash: string,
): Promise<OnChainTxOutcome> {
  const receipt = await fetchTransactionReceipt(network, txHash, false);
  if (!receipt) return "pending";
  return receipt.status === "success" ? "success" : "reverted";
}

export async function getTxConfirmationCount(
  network: StakingNetwork,
  txHash: string,
): Promise<number> {
  try {
    const receipt = await fetchTransactionReceipt(network, txHash, false);
    if (!receipt || receipt.status !== "success") return 0;
    const head = await publicClient(network).getBlockNumber();
    if (head < receipt.blockNumber) return 0;
    return Number(head - receipt.blockNumber + 1n);
  } catch {
    return 0;
  }
}

function treasuryOrNull(network: StakingNetwork): string | null {
  const treasury = getDepositAddress(network);
  if (
    !treasury ||
    treasury.toLowerCase() === "0x0000000000000000000000000000000000000000"
  ) {
    return null;
  }
  return treasury.toLowerCase();
}

/** Fast inspect: receipt + tx input. Never waits more than a few seconds. */
export async function inspectUsdtDepositTx(input: {
  network: StakingNetwork;
  txHash: string;
  expectedFrom?: string;
}): Promise<DepositVerifyResult> {
  const expectedTo = treasuryOrNull(input.network);
  const chainLabel = input.network === "POLYGON" ? "Polygon" : "BNB Chain";
  if (!expectedTo) {
    return {
      ok: false,
      code: "TX_NOT_FOUND",
      message: `Valtrix ${chainLabel} treasury is not configured. Contact support.`,
    };
  }

  const receipt = await fetchTransactionReceipt(input.network, input.txHash, true);
  if (receipt) {
    if (receipt.status !== "success") {
      return {
        ok: false,
        code: "TX_REVERTED",
        message: "Transaction failed on-chain. No USDT was sent.",
      };
    }
    const matched = parseVerifiedTransfer(receipt, {
      network: input.network,
      expectedFrom: input.expectedFrom,
      expectedTo,
    });
    if (matched) return { ok: true, deposit: matched, mined: true };

    const anyUsdt = parseAnyUsdtTransfer(receipt, input.network);
    if (anyUsdt && anyUsdt.toAddress !== expectedTo) {
      return {
        ok: false,
        code: "TX_WRONG_TREASURY",
        sentTo: anyUsdt.toAddress,
        expectedTo,
        message: `USDT went to ${shortAddr(anyUsdt.toAddress)}, not the Valtrix ${chainLabel} treasury ${shortAddr(expectedTo)}. Send again using the address shown in the app, or paste this hash to support.`,
      };
    }
    return {
      ok: false,
      code: "TX_WRONG_TOKEN",
      expectedTo,
      message: `This hash is not a USDT transfer to the Valtrix ${chainLabel} treasury ${shortAddr(expectedTo)}. Check the network (BSC vs Polygon) and token.`,
    };
  }

  const tx = await fetchTransaction(input.network, input.txHash);
  if (!tx) {
    return {
      ok: false,
      code: "TX_NOT_FOUND",
      expectedTo,
      message: `Transaction not found on ${chainLabel} yet. Wait a few seconds, stay on ${chainLabel}, and try the same hash again.`,
    };
  }

  const decoded = decodeTransferCall(tx, input.network);
  if (!decoded) {
    return {
      ok: false,
      code: "TX_WRONG_TOKEN",
      expectedTo,
      message: `This hash is not a USDT transfer on ${chainLabel}. Select the same network you sent on.`,
    };
  }
  if (decoded.toAddress !== expectedTo) {
    return {
      ok: false,
      code: "TX_WRONG_TREASURY",
      sentTo: decoded.toAddress,
      expectedTo,
      message: `USDT was sent to ${shortAddr(decoded.toAddress)}, not the Valtrix ${chainLabel} treasury ${shortAddr(expectedTo)}.`,
    };
  }
  if (
    input.expectedFrom &&
    decoded.fromAddress !== input.expectedFrom.toLowerCase()
  ) {
    return {
      ok: false,
      code: "TX_WRONG_TOKEN",
      message: "This transfer was sent from a different wallet than this account.",
    };
  }
  return { ok: true, deposit: decoded, mined: false };
}

/** Confirms a USDT transfer to the treasury. Sender may be any wallet (CEX, another EOA). */
export async function verifyUsdtDepositTx(input: {
  network: StakingNetwork;
  txHash: string;
  expectedFrom?: string;
  waitForMining?: boolean;
}): Promise<VerifiedUsdtDeposit | null> {
  const result = await inspectUsdtDepositTx(input);
  if (!result.ok) return null;
  if (!result.mined && input.waitForMining === false) return result.deposit;
  return result.mined ? result.deposit : result.deposit;
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
