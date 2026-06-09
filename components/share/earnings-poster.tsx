"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
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

interface EarningsPosterProps {
  username: string;
  earnings: PeriodEarningsDetailed;
}

export function EarningsPoster({ username, earnings }: EarningsPosterProps) {
  const { t } = useI18n();
  const [active, setActive] = React.useState<PosterPeriod>("daily");
  const [preview, setPreview] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const meta = React.useMemo(
    () => getPosterPeriodMeta(active, earnings),
    [active, earnings],
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
    const periodMeta = getPosterPeriodMeta(period, earnings);
    const url = await renderEarningsPoster(periodMeta, username, labels);
    downloadDataUrl(
      url,
      `valtrix-ganancia-${periodMeta.filenameSuffix}-${username}.png`,
    );
  }

  async function downloadAll() {
    for (const period of PERIODS) {
      await downloadOne(period);
    }
  }

  const periodLabel = (p: PosterPeriod) => {
    if (p === "daily") return t("share.poster.daily");
    if (p === "weekly") return t("share.poster.weekly");
    if (p === "monthly") return t("share.poster.monthly");
    return t("share.poster.threeMonths");
  };

  const slice = earnings[active];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setActive(p)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs transition-colors",
              active === p
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-border-subtle text-text-secondary hover:bg-bg-hover",
            )}
          >
            {periodLabel(p)}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gold/25 bg-bg-base">
        {loading || !preview ? (
          <div className="flex aspect-square items-center justify-center bg-bg-elevated">
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

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <BreakdownStat
          label={t("share.poster.periodTotal")}
          value={slice.total}
          accent
        />
        <BreakdownStat
          label={t("share.poster.base")}
          value={slice.base}
        />
        <BreakdownStat
          label={t("share.poster.operational")}
          value={slice.operational}
        />
        <BreakdownStat
          label={t("share.poster.network")}
          value={slice.network}
        />
      </div>
      <p className="text-center text-xs text-text-muted">
        {t("share.poster.breakdownNote")}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={() => downloadOne(active)}
          disabled={loading}
        >
          <Download className="h-4 w-4" />
          {t("share.downloadPeriod", { period: periodLabel(active) })}
        </Button>
        <Button variant="outline" size="md" onClick={downloadAll} disabled={loading}>
          <Download className="h-4 w-4" />
          {t("share.downloadAll")}
        </Button>
      </div>
    </div>
  );
}

function BreakdownStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-base/50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-base",
          accent ? "text-gold" : "text-text-primary",
        )}
      >
        ${formatNumber(value, { decimals: 2 })}
      </p>
    </div>
  );
}

