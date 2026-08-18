import { utcDayKey, utcDayStart } from "./utc-day";

export type CopyIncomePeriod = "DAY" | "WEEK" | "MONTH" | "QUARTER" | "ALL";

export const COPY_INCOME_PERIODS: readonly CopyIncomePeriod[] = [
  "DAY",
  "WEEK",
  "MONTH",
  "QUARTER",
  "ALL",
];

export function isCopyIncomePeriod(value: string): value is CopyIncomePeriod {
  return (COPY_INCOME_PERIODS as readonly string[]).includes(value);
}

export function utcIsoWeekStart(now: Date): Date {
  const start = utcDayStart(now);
  const weekday = start.getUTCDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  start.setUTCDate(start.getUTCDate() - delta);
  return start;
}

export function utcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function utcQuarterStart(now: Date): Date {
  const month = Math.floor(now.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(now.getUTCFullYear(), month, 1));
}

export function copyIncomeRange(
  period: CopyIncomePeriod,
  now: Date,
): { from: Date | null; to: Date } {
  const to = now;
  if (period === "DAY") return { from: utcDayStart(now), to };
  if (period === "WEEK") return { from: utcIsoWeekStart(now), to };
  if (period === "MONTH") return { from: utcMonthStart(now), to };
  if (period === "QUARTER") return { from: utcQuarterStart(now), to };
  return { from: null, to };
}

export function copyIncomeBucketKey(
  period: CopyIncomePeriod,
  at: Date,
): string {
  if (period === "QUARTER" || period === "ALL") {
    return at.toISOString().slice(0, 7);
  }
  return utcDayKey(at);
}

export function copyIncomeBucketLabels(
  period: CopyIncomePeriod,
  from: Date | null,
  to: Date,
): string[] {
  if (from == null) return [];
  if (period === "QUARTER") {
    const labels: string[] = [];
    const cursor = new Date(from);
    while (cursor.getTime() <= to.getTime()) {
      labels.push(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return labels;
  }
  const labels: string[] = [];
  const cursor = utcDayStart(from);
  const last = utcDayStart(to);
  while (cursor.getTime() <= last.getTime()) {
    labels.push(utcDayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return labels;
}

export function absFeeMicro(amount: bigint | null | undefined): bigint {
  const value = amount ?? 0n;
  return value < 0n ? -value : value;
}

export function parseCopyInOutFeeMicro(note: string | null | undefined): bigint {
  if (!note) return 0n;
  const match = note.match(/fee\s+([0-9]+(?:\.[0-9]+)?)\s+USDT/i);
  if (!match) return 0n;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0n;
  return BigInt(Math.round(value * 1_000_000));
}
