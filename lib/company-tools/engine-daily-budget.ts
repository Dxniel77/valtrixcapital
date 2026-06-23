import { utcDateKey } from "@/lib/company-tools/global-metrics";
import { createSeededRng } from "@/lib/company-tools/seeded-rng";

/** Client target: bot trading daily profit (UTC). */
export const BOT_DAILY_MIN_USD = 8_000;
export const BOT_DAILY_MAX_USD = 40_000;

/** Client target: liquidation engine daily fees (UTC). */
export const LIQUIDATION_DAILY_MIN_USD = 5_000;
export const LIQUIDATION_DAILY_MAX_USD = 10_000;

const BOT_BUDGET_SALT = 0x8001;
const LIQUIDATION_BUDGET_SALT = 0x1101;

const botBudgetMemo = new Map<string, number>();
const liquidationBudgetMemo = new Map<string, number>();

function daySeed(dayKey: string, salt: number): number {
  let hash = salt;
  for (let i = 0; i < dayKey.length; i += 1) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function budgetFromRange(
  dayKey: string,
  salt: number,
  minUsd: number,
  maxUsd: number,
  decimals: number,
): number {
  const rng = createSeededRng(daySeed(dayKey, salt));
  const raw = minUsd + rng.next() * (maxUsd - minUsd);
  const factor = 10 ** decimals;
  return Math.round(raw * factor) / factor;
}

/** Fixed daily bot profit for a UTC day — identical for every user, never changes. */
export function botDailyBudget(dayKey: string): number {
  const cached = botBudgetMemo.get(dayKey);
  if (cached != null) return cached;
  const value = budgetFromRange(
    dayKey,
    BOT_BUDGET_SALT,
    BOT_DAILY_MIN_USD,
    BOT_DAILY_MAX_USD,
    0,
  );
  botBudgetMemo.set(dayKey, value);
  return value;
}

/** Fixed daily liquidation fees for a UTC day — identical for every user, never changes. */
export function liquidationDailyBudget(dayKey: string): number {
  const cached = liquidationBudgetMemo.get(dayKey);
  if (cached != null) return cached;
  const value = budgetFromRange(
    dayKey,
    LIQUIDATION_BUDGET_SALT,
    LIQUIDATION_DAILY_MIN_USD,
    LIQUIDATION_DAILY_MAX_USD,
    2,
  );
  liquidationBudgetMemo.set(dayKey, value);
  return value;
}

/** Fraction of the UTC day elapsed at `now` (0 at 00:00, 1 at 24:00). */
export function utcDayProgress(now = Date.now()): number {
  const d = new Date(now);
  const ms =
    d.getUTCHours() * 3_600_000 +
    d.getUTCMinutes() * 60_000 +
    d.getUTCSeconds() * 1_000 +
    d.getUTCMilliseconds();
  return ms / 86_400_000;
}

/** Bot revenue credited for `dayKey` — full budget on closed days, linear accrual today. */
export function botDailyRevenue(dayKey: string, now = Date.now()): number {
  const budget = botDailyBudget(dayKey);
  const todayKey = utcDateKey(now);
  if (dayKey < todayKey) return budget;
  if (dayKey > todayKey) return 0;
  return Math.round(budget * utcDayProgress(now));
}

/** Liquidation fees credited for `dayKey` — full budget on closed days, linear accrual today. */
export function liquidationDailyRevenue(dayKey: string, now = Date.now()): number {
  const budget = liquidationDailyBudget(dayKey);
  const todayKey = utcDateKey(now);
  if (dayKey < todayKey) return budget;
  if (dayKey > todayKey) return 0;
  return Math.round(budget * utcDayProgress(now) * 100) / 100;
}

/** Pre-cache a closed-day budget (fast — no slot iteration). */
export function warmDailyBudgetsForDay(dayKey: string, todayKey: string): void {
  if (dayKey >= todayKey) return;
  botDailyBudget(dayKey);
  liquidationDailyBudget(dayKey);
}
