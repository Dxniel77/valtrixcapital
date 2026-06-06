"use client";

import { RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export type ChartIndicatorState = {
  volume: boolean;
  ema20: boolean;
  ema50: boolean;
};

export const DEFAULT_CHART_INDICATORS: ChartIndicatorState = {
  volume: true,
  ema20: true,
  ema50: false,
};

type ChartIndicatorsProps = {
  value: ChartIndicatorState;
  onChange: (next: ChartIndicatorState) => void;
  onResetZoom?: () => void;
  className?: string;
};

export function ChartIndicators({
  value,
  onChange,
  onResetZoom,
  className,
}: ChartIndicatorsProps) {
  const { t } = useI18n();

  const toggles: {
    key: keyof ChartIndicatorState;
    label: string;
    color?: string;
  }[] = [
    { key: "volume", label: t("trade.indicators.volume") },
    { key: "ema20", label: t("trade.indicators.ema20"), color: "#F97316" },
    { key: "ema50", label: t("trade.indicators.ema50"), color: "#A855F7" },
  ];

  function toggle(key: keyof ChartIndicatorState) {
    onChange({ ...value, [key]: !value[key] });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto border-b border-border-subtle px-3 py-2",
        "scrollbar-none",
        className,
      )}
    >
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {t("trade.indicators.title")}
      </span>
      {toggles.map(({ key, label, color }) => {
        const active = value[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "border-gold/40 bg-gold/10 text-text-primary"
                : "border-border-subtle bg-bg-base/50 text-text-muted hover:border-border-strong hover:text-text-secondary",
            )}
            aria-pressed={active}
          >
            {color ? (
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: active ? color : "hsl(var(--text-muted))" }}
              />
            ) : null}
            {label}
          </button>
        );
      })}
      {onResetZoom ? (
        <button
          type="button"
          onClick={onResetZoom}
          className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-border-subtle px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
          title={t("trade.indicators.resetZoom")}
        >
          <RotateCcw className="h-3 w-3" />
          <span className="hidden sm:inline">{t("trade.indicators.resetZoom")}</span>
        </button>
      ) : null}
    </div>
  );
}
