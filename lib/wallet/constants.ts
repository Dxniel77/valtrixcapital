import type { StakingNetwork } from "@/lib/staking/store";

/** Flat 4% withdrawal fee (matches AppConfig.withdrawalFeeBps default). */
export const WITHDRAWAL_FEE_BPS = 400;

export const WITHDRAWAL_FEE_PCT = WITHDRAWAL_FEE_BPS / 100;

/** Minimum withdrawal in USDT. */
export const MIN_WITHDRAWAL_USDT = 1;

/**
 * Development-only fallback deposit addresses when env vars are unset.
 * Production builds require NEXT_PUBLIC_TREASURY_* env addresses.
 */
export const DEPOSIT_ADDRESSES: Record<StakingNetwork, string> = {
  BSC: "0x7Af2C0bD9C5E1bE0aA4f9d2b3C8E51Df6A0c4B21",
  POLYGON: "0xD41eBb9a7C2F60aE3b8C1d5E7f09A2B4c6D83e15",
};

/** USDT token contracts (display only) per network. */
export const USDT_CONTRACTS: Record<StakingNetwork, string> = {
  BSC: "0x55d398326f99059fF775485246999027B3197955",
  POLYGON: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
};

export interface WithdrawalBreakdown {
  amount: number;
  feeBps: number;
  fee: number;
  netAmount: number;
}

export function computeWithdrawal(
  amount: number,
  feeBps: number = WITHDRAWAL_FEE_BPS,
): WithdrawalBreakdown {
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const fee = (safe * feeBps) / 10_000;
  return {
    amount: safe,
    feeBps,
    fee,
    netAmount: Math.max(0, safe - fee),
  };
}
