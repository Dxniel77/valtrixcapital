import type { StakingNetwork } from "@/lib/staking/store";
import { DEPOSIT_ADDRESSES, USDT_CONTRACTS } from "@/lib/wallet/constants";
import { allowOfflineSimulation } from "@/lib/runtime-mode";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isUsableTreasuryAddress(value: string | undefined): value is string {
  return (
    !!value &&
    /^0x[a-fA-F0-9]{40}$/.test(value) &&
    value.toLowerCase() !== ZERO_ADDRESS
  );
}

/** Live treasury used by the mobile app and production .env. */
const LIVE_TREASURY = "0xa7d57f3d881dba992cdafe85f5a3e3115626f2cc";

/** Treasury deposit addresses — env required; live wallet is the last-resort fallback. */
export function getDepositAddress(network: StakingNetwork): string {
  const env =
    network === "BSC"
      ? process.env.NEXT_PUBLIC_TREASURY_BSC_ADDRESS?.trim()
      : process.env.NEXT_PUBLIC_TREASURY_POLYGON_ADDRESS?.trim();
  if (isUsableTreasuryAddress(env)) return env.toLowerCase();
  if (isUsableTreasuryAddress(LIVE_TREASURY)) return LIVE_TREASURY;
  if (!allowOfflineSimulation()) return "";
  const fallback = DEPOSIT_ADDRESSES[network];
  return isUsableTreasuryAddress(fallback) ? fallback.toLowerCase() : "";
}

export function getUsdtContract(network: StakingNetwork): string {
  return USDT_CONTRACTS[network];
}
