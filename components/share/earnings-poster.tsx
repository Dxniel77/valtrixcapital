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
    const period = active;
    const key = buildPosterCacheKey(period, earnings, locale, username);
    if (cacheKeysRef.current[period] === key) return;

    setGenerating(true);

    void (async () => {
      const periodMeta = getPosterPeriodMeta(period, earnings, locale);
      const url = await renderEarningsPoster(
        periodMeta,
        username,
        posterLabels(period),
      );
      if (cancelled) return;
      setPosterCache((prev) => ({ ...prev, [period]: url }));
      cacheKeysRef.current[period] = key;
    })()
      .catch(() => {
        /* keep previous cache on failure */
      })
      .finally(() => {
        if (!cancelled) setGenerating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, earnings, username, locale, posterLabels]);

  React.useEffect(() => {
    const others = PERIODS.filter((p) => p !== active);
    let cancelled = false;

    const schedule =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 1500);

    const idleId = schedule(() => {
      void (async () => {
        for (const period of others) {
          if (cancelled) return;
          const key = buildPosterCacheKey(period, earnings, locale, username);
          if (cacheKeysRef.current[period] === key) continue;
          const periodMeta = getPosterPeriodMeta(period, earnings, locale);
          const url = await renderEarningsPoster(
            periodMeta,
            username,
            posterLabels(period),
          );
          if (cancelled) return;
          setPosterCache((prev) => ({ ...prev, [period]: url }));
          cacheKeysRef.current[period] = key;
        }
      })();
    });

    return () => {
      cancelled = true;
      if (typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleId as number);
      } else {
        window.clearTimeout(idleId as number);
      }
    };
  }, [active, earnings, username, locale, posterLabels]);

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
    <div className="space-y-5">
      {/* Segmented period control */}
      <div
        className="rounded-2xl border border-border-subtle/80 bg-bg-base/60 p-1.5 backdrop-blur-sm"
        role="tablist"
        aria-label={t("share.posterSection")}
      >
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {periodCards.map(({ period, meta: cardMeta, slice: cardSlice }) => {
            const Icon = PERIOD_ICONS[period];
            const selected = active === period;
            return (
              <button
                key={period}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(period)}
                className={cn(
                  "group relative overflow-hidden rounded-xl px-3 py-2.5 text-left transition-all duration-200",
                  selected
                    ? "bg-gradient-to-br from-gold/20 via-gold/10 to-transparent shadow-[inset_0_1px_0_0_rgba(212,175,55,0.25)] ring-1 ring-gold/40"
                    : "hover:bg-bg-hover/80",
                )}
              >
                {selected ? (
                  <div
                    className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gold/10 blur-2xl"
                    aria-hidden
                  />
                ) : null}
                <div className="relative flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                      selected
                        ? "bg-gold/20 text-gold"
                        : "bg-bg-elevated text-text-muted group-hover:text-text-secondary",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-[10px] font-semibold uppercase tracking-wider",
                        selected ? "text-gold" : "text-text-muted",
                      )}
                    >
                      {periodLabel(period)}
                    </p>
                    <p className="truncate font-mono text-sm font-medium text-text-primary">
                      ${formatNumber(cardSlice.total, { decimals: 2 })}
                    </p>
                  </div>
                </div>
                <p className="relative mt-1 truncate pl-9 text-[9px] text-text-muted">
                  {cardMeta.rangeLabel}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bento: status + preview */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        {/* Status panel */}
        <div className="order-1 space-y-4 rounded-2xl border border-border-subtle/80 bg-gradient-to-br from-bg-elevated/90 to-bg-base/40 p-5 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {t("share.breakdownTitle")}
              </p>
              <p className="mt-1 bg-gradient-to-r from-gold via-gold-bright to-gold bg-clip-text font-mono text-3xl font-semibold tracking-tight text-transparent">
                ${formatNumber(slice.total, { decimals: 2 })}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                <span className="rounded-full bg-bg-base px-2 py-0.5 font-medium text-text-secondary">
                  @{username}
                </span>
                <span aria-hidden>·</span>
                <span>{meta.rangeLabel}</span>
              </p>
            </div>
            <Badge variant="gold" className="shrink-0">
              {periodLabel(active)}
            </Badge>
          </div>

          <BreakdownBar
            base={slice.base}
            operational={slice.operational}
            network={slice.network}
            total={total}
          />

          <div className="grid gap-2 sm:grid-cols-3">
            <BreakdownStat
              icon={Coins}
              accent="gold"
              label={t("share.poster.base")}
              value={slice.base}
              pct={(slice.base / total) * 100}
            />
            <BreakdownStat
              icon={LineChart}
              accent="success"
              label={t("share.poster.operational")}
              value={slice.operational}
              pct={(slice.operational / total) * 100}
            />
            <BreakdownStat
              icon={Users}
              accent="info"
              label={t("share.poster.network")}
              value={slice.network}
              pct={(slice.network / total) * 100}
            />
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row lg:flex-col">
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
              className="w-full border-border-subtle bg-bg-base/50"
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

        {/* Poster preview */}
        <div className="order-2 space-y-2">
          <div className="overflow-hidden rounded-2xl border border-gold/15 bg-bg-elevated/50 p-3 shadow-[0_12px_48px_-16px_rgba(0,0,0,0.55)] backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {t("share.posterSection")}
              </span>
              <span className="text-[10px] text-text-muted">
                {periodLabel(active)}
              </span>
            </div>
            <div className="flex max-h-[min(38vh,320px)] items-center justify-center overflow-hidden rounded-xl bg-bg-base/80 sm:max-h-[min(44vh,380px)]">
              {showPreviewLoader ? (
                <div className="flex aspect-[1024/930] w-full items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-gold" />
                    <span className="text-xs text-text-muted">
                      {t("common.loading")}
                    </span>
                  </div>
                </div>
              ) : preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt={periodLabel(active)}
                  className="max-h-[min(38vh,320px)] w-full object-contain transition-opacity duration-300 sm:max-h-[min(44vh,380px)]"
                />
              ) : null}
            </div>
          </div>
          <p className="px-1 text-center text-[11px] leading-relaxed text-text-muted">
            {t("share.poster.breakdownNote")}
          </p>
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
    { value: base, className: "bg-gradient-to-r from-gold to-gold-bright" },
    { value: operational, className: "bg-gradient-to-r from-success to-emerald-400" },
    { value: network, className: "bg-gradient-to-r from-info to-sky-400" },
  ].filter((s) => s.value > 0);

  if (segments.length === 0) {
    return (
      <div className="mt-1 h-1.5 rounded-full bg-bg-hover" aria-hidden />
    );
  }

  return (
    <div
      className="mt-1 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-bg-hover p-px"
      aria-hidden
    >
      {segments.map((seg) => (
        <div
          key={seg.className}
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            seg.className,
          )}
          style={{ width: `${(seg.value / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

const ACCENT_STYLES = {
  gold: {
    icon: "bg-gold/15 text-gold",
    dot: "bg-gold",
  },
  success: {
    icon: "bg-success/15 text-success",
    dot: "bg-success",
  },
  info: {
    icon: "bg-info/15 text-info",
    dot: "bg-info",
  },
} as const;

function BreakdownStat({
  icon: Icon,
  accent,
  label,
  value,
  pct,
}: {
  icon: React.ElementType;
  accent: keyof typeof ACCENT_STYLES;
  label: string;
  value: number;
  pct: number;
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <div className="rounded-xl border border-border-subtle/60 bg-bg-base/50 p-3 transition-colors hover:border-border-subtle">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            styles.icon,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-[10px] font-medium uppercase tracking-wide text-text-muted">
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="font-mono text-base font-medium text-text-primary">
          ${formatNumber(value, { decimals: 2 })}
        </span>
        <span className="rounded-md bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
          {formatNumber(pct, { decimals: 0 })}%
        </span>
      </div>
    </div>
  );
}
