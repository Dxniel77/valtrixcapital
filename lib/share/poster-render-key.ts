import type { Locale } from "@/lib/i18n/config";
import type {
  PeriodEarningsDetailed,
  PosterPeriod,
} from "@/lib/share/earnings-periods";

const POSTER_PERIODS: PosterPeriod[] = [
  "daily",
  "weekly",
  "monthly",
  "threeMonths",
];

/** Stable key — poster only re-renders when displayed amounts or locale change. */
export function buildPosterCacheKey(
  period: PosterPeriod,
  earnings: PeriodEarningsDetailed,
  locale: Locale,
  username: string,
): string {
  const slice = earnings[period];
  const day = new Date().toISOString().slice(0, 10);
  return [
    period,
    locale,
    username,
    day,
    slice.total.toFixed(2),
    slice.base.toFixed(2),
    slice.operational.toFixed(2),
    slice.network.toFixed(2),
  ].join("|");
}

export function posterEarningsEqual(
  a: PeriodEarningsDetailed,
  b: PeriodEarningsDetailed,
): boolean {
  return POSTER_PERIODS.every((period) => {
    const sa = a[period];
    const sb = b[period];
    return (
      sa.total.toFixed(2) === sb.total.toFixed(2) &&
      sa.base.toFixed(2) === sb.base.toFixed(2) &&
      sa.operational.toFixed(2) === sb.operational.toFixed(2) &&
      sa.network.toFixed(2) === sb.network.toFixed(2)
    );
  });
}
