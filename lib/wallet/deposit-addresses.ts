import type { StakingNetwork } from "@/lib/staking/store";
import { DEPOSIT_ADDRESSES, USDT_CONTRACTS } from "@/lib/wallet/constants";
import { allowOfflineSimulation } from "@/lib/runtime-mode";

export type TreasuryPoolKind = "STAKING" | "COPY";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isUsableTreasuryAddress(value: string | undefined): value is string {
  return (
    !!value &&
    /^0x[a-fA-F0-9]{40}$/.test(value) &&
    value.toLowerCase() !== ZERO_ADDRESS
  );
}

/** Live staking treasury used by the mobile app and production .env. */
const LIVE_TREASURY = "0xa7d57f3d881dba992cdafe85f5a3e3115626f2cc";

/** Live copy-trading treasury (same EOA on BSC and Polygon). */
const LIVE_COPY_TREASURY = "0xfd2d30df62118f13d16b9ef0a831c0626c7ad08d";

function envAddress(
  bscKey: string,
  polygonKey: string,
  network: StakingNetwork,
): string {
  const raw =
    network === "BSC"
      ? process.env[bscKey]?.trim()
      : process.env[polygonKey]?.trim();
  return isUsableTreasuryAddress(raw) ? raw.toLowerCase() : "";
}

/** Staking / yield deposit address. */
export function getDepositAddress(network: StakingNetwork): string {
  const env = envAddress(
    "NEXT_PUBLIC_TREASURY_BSC_ADDRESS",
    "NEXT_PUBLIC_TREASURY_POLYGON_ADDRESS",
    network,
  );
  if (env) return env;
  if (isUsableTreasuryAddress(LIVE_TREASURY)) return LIVE_TREASURY;
  if (!allowOfflineSimulation()) return "";
  const fallback = DEPOSIT_ADDRESSES[network];
  return isUsableTreasuryAddress(fallback) ? fallback.toLowerCase() : "";
}

/** Copy-trading deposit address. Falls back to the live copy wallet, then staking. */
export function getCopyDepositAddress(network: StakingNetwork): string {
  const env = envAddress(
    "NEXT_PUBLIC_COPY_BSC_ADDRESS",
    "NEXT_PUBLIC_COPY_POLYGON_ADDRESS",
    network,
  );
  if (env) return env;
  if (isUsableTreasuryAddress(LIVE_COPY_TREASURY)) return LIVE_COPY_TREASURY;
  return getDepositAddress(network);
}

export function getPoolDepositAddress(
  network: StakingNetwork,
  pool: TreasuryPoolKind = "STAKING",
): string {
  return pool === "COPY"
    ? getCopyDepositAddress(network)
    : getDepositAddress(network);
}

export function getUsdtContract(network: StakingNetwork): string {
  return USDT_CONTRACTS[network];
}
