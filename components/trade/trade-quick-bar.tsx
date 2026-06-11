"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TRADE_DURATIONS, type PairMeta } from "@/lib/market/pairs";
import { useTradeExecution } from "@/lib/hooks/use-trade-execution";
import { cn, formatNumber } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

type TradeQuickBarProps = {
  pair: PairMeta;
  livePrice: number | null;
  duration: number;
  onDurationChange: (seconds: number) => void;
};

export function TradeQuickBar({
  pair,
  livePrice,
  duration,
  onDurationChange,
}: TradeQuickBarProps) {
  const { t } = useI18n();
  const {
    canTrade,
    canBuy,
    canSell,
    hasCapital,
    execute,
    summary,
    maxTrades,
  } = useTradeExecution(pair, livePrice, duration);

  return (
    <div className="border-t border-border-subtle bg-bg-elevated/40 px-3 py-3 sm:px-4">
      {!hasCapital ? (
        <p className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {t("trade.noCapital")}
        </p>
      ) : null}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("trade.quickTrade")}
        </span>
        <Badge variant={canTrade ? "gold" : "warning"} className="shrink-0">
          {summary.attemptsRemaining}/{maxTrades}
        </Badge>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-text-muted">
            {t("trade.duration")}
          </label>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {TRADE_DURATIONS.map((d) => (
              <button
                key={d.seconds}
                type="button"
                onClick={() => onDurationChange(d.seconds)}
                className={cn(
                  "shrink-0 rounded-md border px-3 py-2 text-xs font-mono transition-colors",
                  duration === d.seconds
                    ? "border-gold/50 bg-gold/10 text-gold"
                    : "border-border-subtle bg-bg-base/60 text-text-secondary hover:border-border-strong",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden shrink-0 flex-col sm:flex sm:min-w-[120px]">
          <span className="mb-1.5 text-[10px] uppercase tracking-wider text-text-muted">
            {t("trade.entryPrice")}
          </span>
          <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-2 text-center font-mono text-sm text-text-primary">
            {livePrice
              ? formatNumber(livePrice, { decimals: pair.pricePrecision })
              : "—"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:min-w-[240px] sm:shrink-0">
          <Button
            variant="success"
            size="lg"
            className="h-12 text-sm font-semibold sm:h-11"
            disabled={!canBuy}
            title={!canBuy && canTrade ? t("trade.hedgeBlockedBuy") : undefined}
            onClick={() => execute("UP")}
          >
            {t("common.buy")} <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="danger"
            size="lg"
            className="h-12 text-sm font-semibold sm:h-11"
            disabled={!canSell}
            title={!canSell && canTrade ? t("trade.hedgeBlockedSell") : undefined}
            onClick={() => execute("DOWN")}
          >
            {t("common.sell")} <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
