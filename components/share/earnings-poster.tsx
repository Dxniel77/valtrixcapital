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
import { useI18n } from "@/lib/i18n/context";
import {
  getPosterPeriodMeta,
  type PeriodEarningsDetailed,
  type PosterPeriod,
} from "@/lib/share/earnings-periods";
import {
  downloadDataUrl,
  renderEarningsPoster,
} from "@/lib/share/poster-canvas";
import { cn, formatNumber } from "@/lib/utils";

const PERIODS: PosterPeriod[] = ["daily", "weekly", "monthly", "threeMonths"];

const PERIOD_ICONS: Record<PosterPeriod, React.ElementType> = {
  daily: Calendar,
  weekly: CalendarDays,
  monthly: CalendarRange,
  threeMonths: Layers,
};

interface EarningsPosterProps {
  username: string;
  earnings: PeriodEarningsDetailed;
}

export function EarningsPoster({ username, earnings }: EarningsPosterProps) {
  const { t } = useI18n();
  const [active, setActive] = React.useState<PosterPeriod>("daily");
  const [preview, setPreview] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [downloading, setDownloading] = React.useState<
    PosterPeriod | "all" | null
  >(null);

  const meta = React.useMemo(
    () => getPosterPeriodMeta(active, earnings),
    [active, earnings],
  );

  const periodCards = React.useMemo(
    () =>
      PERIODS.map((period) => ({
        period,
        meta: getPosterPeriodMeta(period, earnings),
        slice: earnings[period],
      })),
    [earnings],
  );

  const labels = React.useMemo(
    () => ({
      userLabel: t("share.poster.userLabel"),
    }),
    [t],
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    renderEarningsPoster(meta, username, labels)
      .then((url) => {
        if (!cancelled) setPreview(url);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meta, username, labels]);

  async function downloadOne(period: PosterPeriod) {
    setDownloading(period);
    try {
      const periodMeta = getPosterPeriodMeta(period, earnings);
      const url = await renderEarningsPoster(periodMeta, username, labels);
      downloadDataUrl(
        url,
        `valtrix-ganancia-${periodMeta.filenameSuffix}-${username}.png`,
      );
    } finally {
      setDownloading(null);
    }
  }

  async function downloadAll() {
    setDownloading("all");
    try {
      for (const period of PERIODS) {
        const periodMeta = getPosterPeriodMeta(period, earnings);
        const url = await renderEarningsPoster(periodMeta, username, labels);
        downloadDataUrl(
          url,
          `valtrix-ganancia-${periodMeta.filenameSuffix}-${username}.png`,
        );
      }
    } finally {
      setDownloading(null);
    }
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
          return (
            <button
              key={period}
              type="button"
              onClick={() => setActive(period)}
              className={cn(
                "relative overflow-hidden rounded-lg border p-4 text-left transition-all",
                selected
                  ? "border-gold/50 bg-gold/5 shadow-[0_0_24px_-6px_rgba(212,175,55,0.35)]"
                  : "border-border-subtle bg-bg-base/40 hover:border-border-strong hover:bg-bg-hover",
              )}
            >
              {selected ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-gold/60 to-transparent" />
              ) : null}
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
                </div>
              </div>
            </button>
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
            {loading || !preview ? (
              <div
                className="flex items-center justify-center bg-bg-elevated"
                style={{ aspectRatio: "1024 / 930" }}
              >
                <Loader2 className="h-8 w-8 animate-spin text-gold" />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt={periodLabel(active)}
                className="w-full object-contain"
              />
            )}
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
              disabled={loading || downloading !== null}
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
              disabled={loading || downloading !== null}
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
