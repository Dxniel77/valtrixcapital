"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TRADE_DURATIONS, type PairMeta } from "@/lib/market/pairs";
import {
  MAX_TRADES_PER_DAY,
  useDailySummary,
  useTradeStore,
} from "@/lib/trade/store";
import { cn, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

interface TradePanelProps {
  pair: PairMeta;
  livePrice: number | null;
}

export function TradePanel({ pair, livePrice }: TradePanelProps) {
  const [duration, setDuration] = React.useState<number>(60);
  const openPosition = useTradeStore((s) => s.openPosition);
  const summary = useDailySummary();

  const canTrade =
    summary.attemptsRemaining > 0 && livePrice !== null && livePrice > 0;

  function handleTrade(direction: "UP" | "DOWN") {
    if (!livePrice) {
      toast.error("Live price unavailable. Hold on a moment.");
      return;
    }
    if (summary.attemptsRemaining <= 0) {
      toast.error("Out of daily attempts — reset at 00:00 UTC.");
      return;
    }
    const pos = openPosition({
      pair: pair.binance,
      direction,
      entryPrice: livePrice,
      durationSec: duration,
    });
    toast.success(
      `${direction === "UP" ? "BUY ↑" : "SELL ↓"} ${pair.base}/${pair.quote} · ${formatNumber(
        pos.entryPrice,
        { decimals: pair.pricePrecision },
      )} · ${duration / 60}m`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Quick Trade</h3>
        <Badge variant={canTrade ? "gold" : "warning"}>
          {summary.attemptsRemaining}/{MAX_TRADES_PER_DAY} left
        </Badge>
      </div>

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-text-muted">
          Duration
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {TRADE_DURATIONS.map((d) => (
            <button
              key={d.seconds}
              type="button"
              onClick={() => setDuration(d.seconds)}
              className={cn(
                "rounded-md border px-2 py-2 text-xs font-mono transition-colors",
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

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-text-muted">
          Entry price
        </label>
        <div className="flex h-11 items-center justify-between rounded-md border border-border-subtle bg-bg-base px-3">
          <span className="font-mono text-base text-text-primary">
            {livePrice
              ? formatNumber(livePrice, { decimals: pair.pricePrecision })
              : "—"}
          </span>
          <span className="text-xs text-text-muted">
            {pair.quote}
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        <Button
          variant="success"
          size="xl"
          className="w-full"
          disabled={!canTrade}
          onClick={() => handleTrade("UP")}
        >
          BUY <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="danger"
          size="xl"
          className="w-full"
          disabled={!canTrade}
          onClick={() => handleTrade("DOWN")}
        >
          SELL <ArrowDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border border-border-subtle bg-bg-base/60 p-3 text-xs">
        <div className="flex justify-between py-0.5 text-text-secondary">
          <span>Base yield (today)</span>
          <span className="font-mono text-text-primary">
            {(summary.baseRateBps / 100).toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between py-0.5 text-text-secondary">
          <span>Bonus from wins</span>
          <span className="font-mono text-gold">
            +{(summary.bonusRateBps / 100).toFixed(2)}%
          </span>
        </div>
        <div className="mt-1.5 flex justify-between border-t border-border-subtle pt-1.5 text-text-primary">
          <span className="font-medium">Total daily</span>
          <span className="font-mono">
            {(summary.totalRateBps / 100).toFixed(2)}%
          </span>
        </div>
      </div>

      {!canTrade && summary.attemptsRemaining === 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            You've used all {MAX_TRADES_PER_DAY} trades today. Attempts reset at
            00:00 UTC.
          </span>
        </div>
      ) : null}
    </div>
  );
}
