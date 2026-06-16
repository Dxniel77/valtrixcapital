"use client";

import * as React from "react";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Coins,
  Download,
  Layers,
  LineChart,
  Loader2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLocaleOption } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/context";
import {
  getPosterPeriodMeta,
  type PeriodEarningsDetailed,
  type PosterPeriod,
} from "@/lib/share/earnings-periods";
import {
  buildPosterCacheKey,
  posterEarningsEqual,
} from "@/lib/share/poster-render-key";
import {
  downloadDataUrl,
  renderEarningsPoster,
  type PosterLabels,
} from "@/lib/share/poster-canvas";
import { cn, formatNumber } from "@/lib/utils";

const PERIODS: PosterPeriod[] = ["daily", "weekly", "monthly", "threeMonths"];

const PERIOD_ICONS: Record<PosterPeriod, React.ElementType> = {
  daily: Calendar,
  weekly: CalendarDays,
  monthly: CalendarRange,
  threeMonths: Layers,
};

const POSTER_HEADING_KEYS: Record<PosterPeriod, string> = {
  daily: "share.poster.imageHeadingDaily",
  weekly: "share.poster.imageHeadingWeekly",
  monthly: "share.poster.imageHeadingMonthly",
  threeMonths: "share.poster.imageHeadingThreeMonths",
};

interface EarningsPosterProps {
  username: string;
  earnings: PeriodEarningsDetailed;
}

function EarningsPosterComponent({ username, earnings }: EarningsPosterProps) {
  const { t, locale } = useI18n();
  const [active, setActive] = React.useState<PosterPeriod>("daily");
  const [posterCache, setPosterCache] = React.useState<
    Partial<Record<PosterPeriod, string>>
  >({});
  const [generating, setGenerating] = React.useState(false);
  const cacheKeysRef = React.useRef<Partial<Record<PosterPeriod, string>>>({});
  const [downloading, setDownloading] = React.useState<
    PosterPeriod | "all" | null
  >(null);

  const localeTag = React.useMemo(
    () => getLocaleOption(locale).htmlLang,
    [locale],
  );

  const posterLabels = React.useCallback(
    (period: PosterPeriod): PosterLabels => ({
      heading: t(POSTER_HEADING_KEYS[period]),
      todayTag: period === "daily" ? t("share.poster.todayTag") : undefined,
      userLabel: t("share.poster.userLabel"),
      feature1: t("share.poster.featureGrowth"),
      feature2: t("share.poster.featureStrategies"),
      feature3: t("share.poster.featureDiscipline"),
      disclaimerLine1: t("share.poster.disclaimerLine1"),
      disclaimerLine2: t("share.poster.disclaimerLine2"),
      localeTag,
    }),
    [t, localeTag],
  );

  const meta = React.useMemo(
    () => getPosterPeriodMeta(active, earnings, locale),
    [active, earnings, locale],
  );

  const periodCards = React.useMemo(
    () =>
      PERIODS.map((period) => ({
        period,
        meta: getPosterPeriodMeta(period, earnings, locale),
        slice: earnings[period],
      })),
    [earnings, locale],
  );

  React.useEffect(() => {
    let cancelled = false;
    const stale = PERIODS.filter((period) => {
      const key = buildPosterCacheKey(period, earnings, locale, username);
      return cacheKeysRef.current[period] !== key;
    });

    if (stale.length === 0) return;

    const hasAnyCached = stale.some(
      (period) => cacheKeysRef.current[period] !== undefined,
    );
    if (!hasAnyCached) setGenerating(true);

    void Promise.all(
      stale.map(async (period) => {
        const key = buildPosterCacheKey(period, earnings, locale, username);
        const periodMeta = getPosterPeriodMeta(period, earnings, locale);
        const url = await renderEarningsPoster(
          periodMeta,
          username,
          posterLabels(period),
        );
        return { period, url, key } as const;
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setPosterCache((prev) => {
          const next = { ...prev };
          for (const { period, url } of entries) {
            next[period] = url;
          }
          return next;
        });
        for (const { period, key } of entries) {
          cacheKeysRef.current[period] = key;
        }
      })
      .catch(() => {
        /* keep previous cache on failure */
      })
      .finally(() => {
        if (!cancelled) setGenerating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [earnings, username, locale, posterLabels]);

  const preview = posterCache[active];
  const showPreviewLoader = !preview && generating;

  function downloadOne(period: PosterPeriod) {
    const periodMeta = getPosterPeriodMeta(period, earnings, locale);
    const filename = `valtrix-ganancia-${periodMeta.filenameSuffix}-${username}.png`;
    const cached = posterCache[period];

    if (cached) {
      downloadDataUrl(cached, filename);
      return;
    }

    setDownloading(period);
    void renderEarningsPoster(periodMeta, username, posterLabels(period))
      .then((url) => downloadDataUrl(url, filename))
      .finally(() => setDownloading(null));
  }

  function downloadAll() {
    setDownloading("all");
    PERIODS.forEach((period, index) => {
      const cached = posterCache[period];
      if (!cached) return;
      const periodMeta = getPosterPeriodMeta(period, earnings, locale);
      window.setTimeout(() => {
        downloadDataUrl(
          cached,
          `valtrix-ganancia-${periodMeta.filenameSuffix}-${username}.png`,
        );
        if (index === PERIODS.length - 1) setDownloading(null);
      }, index * 400);
    });
  }

  const periodLabel = (p: PosterPeriod) => {
    if (p === "daily") return t("share.poster.daily");
    if (p === "weekly") return t("share.poster.weekly");
    if (p === "monthly") return t("share.poster.monthly");
    return t("share.poster.threeMonths");
  };

  const slice = earnings[active];
  const total = slice.total || 1;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {periodCards.map(({ period, meta: cardMeta, slice: cardSlice }) => {
          const Icon = PERIOD_ICONS[period];
          const selected = active === period;
          const isDownloading = downloading === period;
          return (
            <div
              key={period}
              className={cn(
                "relative overflow-hidden rounded-lg border transition-all",
                selected
                  ? "border-gold/50 bg-gold/5 shadow-[0_0_24px_-6px_rgba(212,175,55,0.35)]"
                  : "border-border-subtle bg-bg-base/40",
              )}
            >
              {selected ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-gold/60 to-transparent" />
              ) : null}
              <button
                type="button"
                onClick={() => setActive(period)}
                className="w-full p-4 text-left transition-colors hover:bg-bg-hover"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          selected ? "text-gold" : "text-text-muted",
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs font-semibold uppercase tracking-wider",
                          selected ? "text-gold" : "text-text-secondary",
                        )}
                      >
                        {periodLabel(period)}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xl font-medium text-text-primary">
                      ${formatNumber(cardSlice.total, { decimals: 2 })}
                    </p>
                    <p className="mt-1 truncate text-[10px] uppercase tracking-wide text-text-muted">
                      {cardMeta.rangeLabel}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-muted">
                      <span>
                        {t("share.poster.base")}: $
                        {formatNumber(cardSlice.base, { decimals: 0 })}
                      </span>
                      <span>
                        {t("share.poster.operational")}: $
                        {formatNumber(cardSlice.operational, { decimals: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
              <div className="border-t border-border-subtle/60 px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full text-xs"
                  onClick={() => downloadOne(period)}
                  disabled={downloading !== null || !posterCache[period]}
                >
                  {isDownloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {t("share.downloadPeriod", { period: periodLabel(period) })}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="gold">{periodLabel(active)}</Badge>
            <span className="truncate text-xs text-text-muted">
              @{username} · {meta.rangeLabel}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-gold/20 bg-bg-base shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]">
            {showPreviewLoader ? (
              <div
                className="flex items-center justify-center bg-bg-elevated"
                style={{ aspectRatio: "1024 / 930" }}
              >
                <Loader2 className="h-8 w-8 animate-spin text-gold" />
              </div>
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt={periodLabel(active)}
                className="w-full object-contain"
              />
            ) : null}
          </div>
          <p className="text-center text-xs text-text-muted">
            {t("share.poster.breakdownNote")}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border-subtle bg-bg-base/50 p-4">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("share.breakdownTitle")}
            </h3>
            <p className="mt-0.5 font-mono text-2xl text-gold">
              ${formatNumber(slice.total, { decimals: 2 })}
            </p>

            <BreakdownBar
              base={slice.base}
              operational={slice.operational}
              network={slice.network}
              total={total}
            />

            <div className="mt-4 space-y-1 divide-y divide-border-subtle/60">
              <BreakdownRow
                icon={Coins}
                color="bg-gold"
                label={t("share.poster.base")}
                value={slice.base}
                pct={(slice.base / total) * 100}
              />
              <BreakdownRow
                icon={LineChart}
                color="bg-success"
                label={t("share.poster.operational")}
                value={slice.operational}
                pct={(slice.operational / total) * 100}
              />
              <BreakdownRow
                icon={Users}
                color="bg-info"
                label={t("share.poster.network")}
                value={slice.network}
                pct={(slice.network / total) * 100}
              />
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => downloadOne(active)}
              disabled={downloading !== null || !posterCache[active]}
            >
              {downloading === active ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t("share.downloadPeriod", { period: periodLabel(active) })}
            </Button>
            <Button
              variant="outline"
              size="md"
              className="w-full"
              onClick={downloadAll}
              disabled={
                downloading !== null ||
                PERIODS.some((period) => !posterCache[period])
              }
            >
              {downloading === "all" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t("share.downloadAll")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const EarningsPoster = React.memo(
  EarningsPosterComponent,
  (prev, next) =>
    prev.username === next.username &&
    posterEarningsEqual(prev.earnings, next.earnings),
);

function BreakdownBar({
  base,
  operational,
  network,
  total,
}: {
  base: number;
  operational: number;
  network: number;
  total: number;
}) {
  const segments = [
    { value: base, color: "bg-gold" },
    { value: operational, color: "bg-success" },
    { value: network, color: "bg-info" },
  ].filter((s) => s.value > 0);

  if (segments.length === 0) {
    return (
      <div className="mt-4 h-2 rounded-full bg-bg-hover" aria-hidden />
    );
  }

  return (
    <div
      className="mt-4 flex h-2 overflow-hidden rounded-full bg-bg-hover"
      aria-hidden
    >
      {segments.map((seg) => (
        <div
          key={seg.color}
          className={cn("h-full transition-all duration-500", seg.color)}
          style={{ width: `${(seg.value / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function BreakdownRow({
  icon: Icon,
  color,
  label,
  value,
  pct,
}: {
  icon: React.ElementType;
  color: string;
  label: string;
  value: number;
  pct: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", color)} />
        <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        <span className="truncate text-xs text-text-secondary">{label}</span>
      </div>
      <div className="shrink-0 text-right">
        <span className="font-mono text-sm text-text-primary">
          ${formatNumber(value, { decimals: 2 })}
        </span>
        <span className="ml-2 text-[10px] text-text-muted">
          {formatNumber(pct, { decimals: 0 })}%
        </span>
      </div>
    </div>
  );
}
