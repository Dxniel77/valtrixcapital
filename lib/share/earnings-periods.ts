import type { DailyYield, InstantCredit } from "@/lib/staking/store";
import type { CommissionRecord } from "@/lib/referrals/store";
import { utcDayKey } from "@/lib/trade/store";

export type PosterPeriod = "daily" | "weekly" | "monthly" | "threeMonths";

export interface EarningsSlice {
  base: number;
  operational: number;
  network: number;
  total: number;
}

export interface PeriodEarningsDetailed {
  daily: EarningsSlice;
  weekly: EarningsSlice;
  monthly: EarningsSlice;
  threeMonths: EarningsSlice;
}

export interface PosterPeriodMeta {
  period: PosterPeriod;
  amount: number;
  rangeLabel: string;
  filenameSuffix: string;
  breakdown: Omit<EarningsSlice, "total">;
}

function dayKeyDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return utcDayKey(d.getTime());
}

function sumYieldsSince(yields: DailyYield[], sinceDay: string): number {
  return yields
    .filter((y) => y.date >= sinceDay)
    .reduce((acc, y) => acc + y.creditedAmount, 0);
}

function sumSinceTimestamp(
  items: { createdAt: number; amount: number }[],
  since: number,
): number {
  return items
    .filter((i) => i.createdAt >= since)
    .reduce((acc, i) => acc + i.amount, 0);
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function slice(
  base: number,
  operational: number,
  network: number,
): EarningsSlice {
  return {
    base: round(base),
    operational: round(operational),
    network: round(network),
    total: round(base + operational + network),
  };
}

export function computePeriodEarnings(input: {
  dailyYields: DailyYield[];
  instantCredits: InstantCredit[];
  commissions: CommissionRecord[];
  todayProjectedYield?: number;
}): PeriodEarningsDetailed {
  const now = Date.now();
  const today = utcDayKey();
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const passiveDaily =
    sumYieldsSince(input.dailyYields, today) +
    (input.todayProjectedYield ?? 0);
  const passiveWeekly = sumYieldsSince(input.dailyYields, dayKeyDaysAgo(6));
  const passiveMonthly = sumYieldsSince(input.dailyYields, dayKeyDaysAgo(29));
  const passiveThreeMonths = sumYieldsSince(
    input.dailyYields,
    dayKeyDaysAgo(89),
  );

  const opsDaily = sumSinceTimestamp(input.instantCredits, startOfToday.getTime());
  const opsWeekly = sumSinceTimestamp(
    input.instantCredits,
    now - 7 * 86_400_000,
  );
  const opsMonthly = sumSinceTimestamp(
    input.instantCredits,
    now - 30 * 86_400_000,
  );
  const opsThreeMonths = sumSinceTimestamp(
    input.instantCredits,
    now - 90 * 86_400_000,
  );

  const netDaily = sumSinceTimestamp(input.commissions, startOfToday.getTime());
  const netWeekly = sumSinceTimestamp(
    input.commissions,
    now - 7 * 86_400_000,
  );
  const netMonthly = sumSinceTimestamp(
    input.commissions,
    now - 30 * 86_400_000,
  );
  const netThreeMonths = sumSinceTimestamp(
    input.commissions,
    now - 90 * 86_400_000,
  );

  return {
    daily: slice(passiveDaily, opsDaily, netDaily),
    weekly: slice(passiveWeekly, opsWeekly, netWeekly),
    monthly: slice(passiveMonthly, opsMonthly, netMonthly),
    threeMonths: slice(passiveThreeMonths, opsThreeMonths, netThreeMonths),
  };
}

const MONTHS_ES = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
] as const;

const WEEKDAYS_ES = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIÉRCOLES",
  "JUEVES",
  "VIERNES",
  "SÁBADO",
] as const;

function formatDayEs(d: Date): string {
  return `${d.getUTCDate()} DE ${MONTHS_ES[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}

function formatTodayEs(d: Date): string {
  return `${WEEKDAYS_ES[d.getUTCDay()]}, ${d.getUTCDate()} DE ${MONTHS_ES[d.getUTCMonth()]}`;
}

function formatRangeEs(from: Date, to: Date): string {
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  const sameMonth = sameYear && from.getUTCMonth() === to.getUTCMonth();
  if (sameMonth) {
    return `${from.getUTCDate()} AL ${to.getUTCDate()} DE ${MONTHS_ES[to.getUTCMonth()]}, ${to.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${from.getUTCDate()} DE ${MONTHS_ES[from.getUTCMonth()]} AL ${formatDayEs(to)}`;
  }
  return `${formatDayEs(from)} AL ${formatDayEs(to)}`;
}

export function getPosterPeriodMeta(
  period: PosterPeriod,
  earnings: PeriodEarningsDetailed,
): PosterPeriodMeta {
  const now = new Date();
  const sliceFor = earnings[period];

  switch (period) {
    case "daily":
      return {
        period,
        amount: sliceFor.total,
        rangeLabel: formatTodayEs(now),
        filenameSuffix: "hoy",
        breakdown: {
          base: sliceFor.base,
          operational: sliceFor.operational,
          network: sliceFor.network,
        },
      };
    case "weekly": {
      const from = new Date(now.getTime() - 6 * 86_400_000);
      from.setUTCHours(0, 0, 0, 0);
      return {
        period,
        amount: sliceFor.total,
        rangeLabel: formatRangeEs(from, now),
        filenameSuffix: "semana",
        breakdown: {
          base: sliceFor.base,
          operational: sliceFor.operational,
          network: sliceFor.network,
        },
      };
    }
    case "monthly": {
      const from = new Date(now.getTime() - 29 * 86_400_000);
      from.setUTCHours(0, 0, 0, 0);
      return {
        period,
        amount: sliceFor.total,
        rangeLabel: formatRangeEs(from, now),
        filenameSuffix: "mes",
        breakdown: {
          base: sliceFor.base,
          operational: sliceFor.operational,
          network: sliceFor.network,
        },
      };
    }
    case "threeMonths": {
      const from = new Date(now.getTime() - 89 * 86_400_000);
      from.setUTCHours(0, 0, 0, 0);
      return {
        period,
        amount: sliceFor.total,
        rangeLabel: formatRangeEs(from, now),
        filenameSuffix: "3-meses",
        breakdown: {
          base: sliceFor.base,
          operational: sliceFor.operational,
          network: sliceFor.network,
        },
      };
    }
  }
}
