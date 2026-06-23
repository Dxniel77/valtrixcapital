import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc, polygon } from "viem/chains";
import type { Network } from "@prisma/client";
import { allowOfflineSimulation } from "@/lib/runtime-mode";
import { buildUsdtTransferCall } from "@/lib/wallet/usdt-transfer";

export class AutomaticPayoutError extends Error {
  constructor(
    message: string,
    readonly code:
      | "PAYOUT_SIGNER_NOT_CONFIGURED"
      | "PAYOUT_TX_REVERTED"
      | "PAYOUT_SEND_FAILED",
  ) {
    super(message);
    this.name = "AutomaticPayoutError";
  }
}

function rpcUrl(network: Network): string {
  if (network === "BSC") {
    return (
      process.env.BSC_RPC?.trim() ||
      process.env.NEXT_PUBLIC_BSC_RPC?.trim() ||
      "https://bsc-dataseed.binance.org"
    );
  }
  return (
    process.env.POLYGON_RPC?.trim() ||
    process.env.NEXT_PUBLIC_POLYGON_RPC?.trim() ||
    "https://polygon-bor-rpc.publicnode.com"
  );
}

function normalizePrivateKey(raw: string): `0x${string}` {
  const trimmed = raw.trim();
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as `0x${string}`;
}

/** Server-only treasury hot-wallet key used to push USDT payouts. */
export function getPayoutPrivateKey(network: Network): `0x${string}` | null {
  const specific =
    network === "BSC"
      ? process.env.TREASURY_BSC_PAYOUT_PRIVATE_KEY?.trim()
      : process.env.TREASURY_POLYGON_PAYOUT_PRIVATE_KEY?.trim();
  const shared = process.env.TREASURY_PAYOUT_PRIVATE_KEY?.trim();
  const key = specific || shared;
  if (!key) return null;
  return normalizePrivateKey(key);
}

export function isAutomaticPayoutConfigured(): boolean {
  return Boolean(
    getPayoutPrivateKey("BSC") || getPayoutPrivateKey("POLYGON"),
  );
}

/** Sends net USDT from the treasury hot wallet to the user's destination address. */
export async function executeAutomaticUsdtPayout(input: {
  network: Network;
  toAddress: string;
  netAmount: number;
}): Promise<Hash> {
  const privateKey = getPayoutPrivateKey(input.network);
  if (!privateKey) {
    throw new AutomaticPayoutError(
      allowOfflineSimulation()
        ? "Set TREASURY_PAYOUT_PRIVATE_KEY (or per-network keys) to enable automatic withdrawals in dev."
        : "Automatic payout signer is not configured on the server.",
      "PAYOUT_SIGNER_NOT_CONFIGURED",
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(input.toAddress)) {
    throw new AutomaticPayoutError("Invalid payout address", "PAYOUT_SEND_FAILED");
  }

  const chain = input.network === "BSC" ? bsc : polygon;
  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl(input.network));
  const walletClient = createWalletClient({
    account,
    chain,
    transport,
  });
  const publicClient = createPublicClient({
    chain,
    transport,
  });

  const call = buildUsdtTransferCall(
    input.network,
    input.toAddress as Address,
    input.netAmount,
  );

  let hash: Hash;
  try {
    hash = await walletClient.writeContract({
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args,
      account,
      chain,
    });
  } catch (err) {
    throw new AutomaticPayoutError(
      err instanceof Error ? err.message : "USDT transfer failed",
      "PAYOUT_SEND_FAILED",
    );
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new AutomaticPayoutError(
      "On-chain USDT transfer reverted",
      "PAYOUT_TX_REVERTED",
    );
  }

  return hash;
}
