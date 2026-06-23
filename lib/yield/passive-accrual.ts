import { YIELD_DAY_MS } from "@/lib/yield/timing";

export const MAX_PASSIVE_CATCHUP_PERIODS = 31;

/** Whole periods owed since last credit (or first eligibility). */
export function countPassivePeriodsDue(input: {
  nowMs: number;
  firstEligibleAtMs: number;
  lastAccrualAtMs: number | null;
  intervalMs: number;
}): number {
  const { nowMs, firstEligibleAtMs, lastAccrualAtMs, intervalMs } = input;
  if (intervalMs <= 0 || nowMs < firstEligibleAtMs) return 0;

  const elapsed =
    lastAccrualAtMs == null
      ? nowMs - firstEligibleAtMs
      : nowMs - lastAccrualAtMs;

  if (elapsed < intervalMs) return 0;
  return Math.floor(elapsed / intervalMs);
}

/** Base passive (0.3%) for one accrual period — win bonuses are operational, not passive. */
export function passiveCreditMicroForPeriod(
  capitalMicro: bigint,
  baseRateBps: number,
  intervalMs: number,
): bigint {
  if (capitalMicro <= 0n || baseRateBps <= 0) return 0n;
  const fullDaily = (capitalMicro * BigInt(baseRateBps)) / 10_000n;
  if (intervalMs >= YIELD_DAY_MS) return fullDaily;
  return (fullDaily * BigInt(intervalMs)) / BigInt(YIELD_DAY_MS);
}

/** Client-side USD helper (mirrors server micro math). */
export function passiveCreditUsdtForPeriod(
  capital: number,
  baseRateBps: number,
  intervalMs: number,
): number {
  if (capital <= 0 || baseRateBps <= 0) return 0;
  const fullDaily = (capital * baseRateBps) / 10_000;
  if (intervalMs >= YIELD_DAY_MS) return fullDaily;
  return (fullDaily * intervalMs) / YIELD_DAY_MS;
}
