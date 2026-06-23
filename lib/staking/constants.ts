export const STAKE_MIN_USDT = 15;
export const STAKE_MAX_USDT = 100_000;
export const PAYOUT_CAP_MULTIPLIER = 2; // 200%
export const REQUIRED_CONFIRMATIONS = 12;
/** Passive yield timing — override delay via PASSIVE_YIELD_DELAY_MS env on server. */
export {
  getPassiveYieldDelayMs,
  getYieldAccrualIntervalMs,
} from "@/lib/yield/timing";
