import type { StakingNetwork } from "@/lib/staking/store";
import { DEPOSIT_ADDRESSES, USDT_CONTRACTS } from "@/lib/wallet/constants";

/** Treasury deposit addresses — env overrides demo constants in production. */
export function getDepositAddress(network: StakingNetwork): string {
  const env =
    network === "BSC"
      ? process.env.NEXT_PUBLIC_TREASURY_BSC_ADDRESS?.trim()
      : process.env.NEXT_PUBLIC_TREASURY_POLYGON_ADDRESS?.trim();
  if (env && /^0x[a-fA-F0-9]{40}$/.test(env)) return env;
  return DEPOSIT_ADDRESSES[network];
}

export function getUsdtContract(network: StakingNetwork): string {
  return USDT_CONTRACTS[network];
}
