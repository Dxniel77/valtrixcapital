import { parseUnits, type Address } from "viem";
import type { StakingNetwork } from "@/lib/staking/store";
import { getUsdtContract } from "@/lib/wallet/deposit-addresses";

/** USDT decimals per network (BEP-20 vs Polygon). */
export const USDT_DECIMALS: Record<StakingNetwork, number> = {
  BSC: 18,
  POLYGON: 6,
};

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

export function usdtAmountToUnits(
  amountUsdt: number,
  network: StakingNetwork,
): bigint {
  const decimals = USDT_DECIMALS[network];
  if (!Number.isFinite(amountUsdt) || amountUsdt <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
  const fixed = amountUsdt.toFixed(Math.min(6, decimals));
  return parseUnits(fixed, decimals);
}

export function buildUsdtTransferCall(
  network: StakingNetwork,
  to: Address,
  amountUsdt: number,
) {
  return {
    address: getUsdtContract(network) as Address,
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer" as const,
    args: [to, usdtAmountToUnits(amountUsdt, network)] as const,
  };
}
