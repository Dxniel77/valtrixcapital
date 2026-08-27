import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  type Address,
} from "viem";
import { bsc, polygon } from "viem/chains";
import type { Network } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fromMicro } from "@/lib/utils";
import {
  getCopyDepositAddress,
  getUsdtContract,
} from "@/lib/wallet/deposit-addresses";
import { USDT_DECIMALS } from "@/lib/wallet/usdt-transfer";

const RPC_TIMEOUT_MS = 6_000;

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

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

/** USDT sitting in the copy hot wallet. Null if the address or RPC is unavailable. */
export async function readCopyWalletUsdt(network: Network): Promise<number | null> {
  const rawAddress = getCopyDepositAddress(network);
  if (!rawAddress) return null;

  try {
    const chain = network === "POLYGON" ? polygon : bsc;
    const client = createPublicClient({
      chain,
      transport: http(rpcUrl(network), { timeout: RPC_TIMEOUT_MS }),
    });
    const units = await client.readContract({
      address: getAddress(getUsdtContract(network)) as Address,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [getAddress(rawAddress) as Address],
    });
    return Number(formatUnits(units, USDT_DECIMALS[network]));
  } catch {
    return null;
  }
}

async function reservedCopyPayouts(network: Network): Promise<number> {
  const rows = await prisma.withdrawal.aggregate({
    where: {
      source: "COPY_CASH",
      network,
      status: { in: ["REQUESTED", "APPROVED", "SENT"] },
    },
    _sum: { netAmount: true },
  });
  return fromMicro(rows._sum.netAmount ?? 0n);
}

/**
 * What copy-cash withdrawals can actually pay: live copy-wallet USDT minus
 * copy withdrawals that are already queued but not confirmed on-chain.
 */
export async function getCopyPayoutLiquidity(
  network: Network,
): Promise<number | null> {
  const onChain = await readCopyWalletUsdt(network);
  if (onChain == null) return null;
  const reserved = await reservedCopyPayouts(network);
  return Math.max(0, onChain - reserved);
}
