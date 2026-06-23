import { warmDailyBudgetsForDay } from "@/lib/company-tools/engine-daily-budget";
import { dayKeysThrough, utcDateKey } from "@/lib/company-tools/global-metrics";

/**
 * Pre-caches closed UTC day budgets so aggregate totals are instant on first paint.
 */
export async function warmEngineDailyLedgers(
  _botCadenceMs: number,
  _liquidationCadenceMs: number,
  now = Date.now(),
): Promise<void> {
  const todayKey = utcDateKey(now);
  for (const dayKey of dayKeysThrough(todayKey)) {
    warmDailyBudgetsForDay(dayKey, todayKey);
  }
}
