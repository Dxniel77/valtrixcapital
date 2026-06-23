import type { Locale } from "@/lib/i18n/config";
import { getLocaleOption } from "@/lib/i18n/config";
import type { DailyYield, InstantCredit } from "@/lib/staking/store";
import type { CommissionRecord } from "@/lib/referrals/store";
import { utcDayKey } from "@/lib/trade/constants";

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

/** Period earnings from credited ledger rows (instant trade-win credits, daily yields, commissions). */
export function computePeriodEarnings(input: {
  dailyYields: DailyYield[];
  instantCredits: InstantCredit[];
  commissions: CommissionRecord[];
  /** Today's not-yet-accrued base passive (0.3% only). */
  todayProjectedYield?: number;
}): PeriodEarningsDetailed {
  const now = Date.now();
  const today = utcDayKey();
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();

  const passiveDaily =
    sumYieldsSince(input.dailyYields, today) +
    (input.todayProjectedYield ?? 0);
  const passiveWeekly = sumYieldsSince(input.dailyYields, dayKeyDaysAgo(6));
  const passiveMonthly = sumYieldsSince(input.dailyYields, dayKeyDaysAgo(29));
  const passiveThreeMonths = sumYieldsSince(
    input.dailyYields,
    dayKeyDaysAgo(89),
  );

  const opsDaily = sumSinceTimestamp(input.instantCredits, startOfTodayMs);
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

  const netDaily = sumSinceTimestamp(input.commissions, startOfTodayMs);
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

/** Lifetime credited earnings — same buckets Share uses, full history. */
export function computeLifetimeCreditedEarnings(input: {
  dailyYields: DailyYield[];
  instantCredits: InstantCredit[];
  networkEarned: number;
  passiveProjectedToday: number;
}): EarningsSlice {
  const base = round(
    input.dailyYields.reduce((acc, y) => acc + y.creditedAmount, 0) +
      input.passiveProjectedToday,
  );
  const operational = round(
    input.instantCredits.reduce((acc, c) => acc + c.amount, 0),
  );
  const network = round(input.networkEarned);
  return slice(base, operational, network);
}

function posterIntlLocale(locale: Locale): string {
  return getLocaleOption(locale).htmlLang;
}

function formatPosterDay(locale: Locale, d: Date): string {
  return new Intl.DateTimeFormat(posterIntlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function formatPosterRange(locale: Locale, from: Date, to: Date): string {
  const tag = posterIntlLocale(locale);
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  };
  if (typeof Intl.DateTimeFormat.prototype.formatRange === "function") {
    return new Intl.DateTimeFormat(tag, opts).formatRange(from, to);
  }
  return `${formatPosterDay(locale, from)} – ${formatPosterDay(locale, to)}`;
}

export function getPosterPeriodMeta(
  period: PosterPeriod,
  earnings: PeriodEarningsDetailed,
  locale: Locale,
): PosterPeriodMeta {
  const now = new Date();
  const sliceFor = earnings[period];

  switch (period) {
    case "daily":
      return {
        period,
        amount: sliceFor.total,
        rangeLabel: formatPosterDay(locale, now),
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
        rangeLabel: formatPosterRange(locale, from, now),
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
        rangeLabel: formatPosterRange(locale, from, now),
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
        rangeLabel: formatPosterRange(locale, from, now),
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
