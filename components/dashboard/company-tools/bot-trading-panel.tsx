"use client";

import * as React from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bot,
  TrendingUp,
} from "lucide-react";

import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import {
  useBotStore,
  useBotStoreHydrated,
  useCompanyProfits,
  botProfitUsd,
  type BotOperation,
} from "@/lib/bot/store";
import { PAIRS } from "@/lib/market/pairs";
import { useTickers } from "@/lib/market/use-tickers";
import { cn, formatNumber, networkLabel } from "@/lib/utils";

export function BotTradingPanel() {
  const { t } = useI18n();
  const hydrated = useBotStoreHydrated();
  const operations = useBotStore((s) => s.operations);
  const profits = useCompanyProfits();
  const syncMarketAnchors = useBotStore((s) => s.syncMarketAnchors);
  const symbols = React.useMemo(() => PAIRS.map((p) => p.binance), []);
  const tickers = useTickers(symbols);

  React.useEffect(() => {
    const prices: Record<string, number> = {};
    for (const [symbol, ticker] of Object.entries(tickers)) {
      if (ticker?.price) prices[symbol] = ticker.price;
    }
    if (Object.keys(prices).length > 0) syncMarketAnchors(prices);
  }, [tickers, syncMarketAnchors]);

  const winRate = React.useMemo(() => {
    if (operations.length === 0) return 0;
    const wins = operations.filter((o) => o.pnlBps > 0).length;
    return (wins / operations.length) * 100;
  }, [operations]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Badge variant="success">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
          {t("botPage.live")}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("botPage.profitToday")}
          value={`$${formatNumber(profits.today, { decimals: 0 })}`}
          icon={TrendingUp}
          accent="success"
          hint={t("botPage.profitTodayHint")}
        />
        <StatTile
          label={t("botPage.profitWeek")}
          value={`$${formatNumber(profits.week, { decimals: 0 })}`}
          icon={Activity}
          accent="gold"
          hint={t("botPage.profitWeekHint")}
        />
        <StatTile
          label={t("botPage.profitAllTime")}
          value={`$${formatNumber(profits.allTime, { decimals: 0 })}`}
          icon={Bot}
          accent="info"
          hint={t("botPage.profitAllTimeHint")}
        />
        <StatTile
          label={t("botPage.winRate")}
          value={`${formatNumber(winRate, { decimals: 1 })}%`}
          icon={TrendingUp}
          accent="silver"
          hint={t("botPage.winRateHint")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("botPage.feedTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden grid-cols-[1fr_0.7fr_0.9fr_0.9fr_0.8fr_0.7fr_0.6fr] gap-3 border-b border-border-subtle px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted md:grid">
            <span>{t("botPage.colPair")}</span>
            <span>{t("botPage.colDirection")}</span>
            <span className="text-right">{t("botPage.colPrice")}</span>
            <span className="text-right">{t("botPage.colVolume")}</span>
            <span className="text-right">{t("botPage.colPnl")}</span>
            <span className="text-right">{t("botPage.colTime")}</span>
            <span className="text-right">{t("botPage.colNetwork")}</span>
          </div>
          {!hydrated ? (
            <FeedSkeleton />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {operations.map((op, idx) => (
                <BotRow key={op.id} op={op} isNewest={idx === 0} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-base/40 px-4 py-3 text-xs text-text-muted">
        <p>{t("botPage.profitResetHint")}</p>
        <p>{t("botPage.priceContinuityHint")}</p>
      </div>

      <p className="text-xs text-text-muted">{t("botPage.disclaimer")}</p>
    </div>
  );
}

function BotRow({ op, isNewest }: { op: BotOperation; isNewest: boolean }) {
  const { t } = useI18n();
  const pair = PAIRS.find((p) => p.binance === op.pair);
  const up = op.direction === "UP";
  const profit = botProfitUsd(op);
  const positive = op.pnlBps >= 0;

  return (
    <li
      className={cn(
        "grid grid-cols-2 items-center gap-3 px-3 py-2.5 text-sm md:grid-cols-[1fr_0.7fr_0.9fr_0.9fr_0.8fr_0.7fr_0.6fr]",
        isNewest && "animate-fade-in bg-gold/[0.03]",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-6 w-6 shrink-0 rounded-full"
          style={{ background: `${pair?.color ?? "#888"}33` }}
          aria-hidden
        />
        <span className="font-mono text-text-primary">
          {pair?.base ?? op.pair.replace("USDT", "")}/USDT
        </span>
      </div>

      <span
        className={cn(
          "inline-flex items-center gap-1 font-mono",
          up ? "text-success" : "text-danger",
        )}
      >
        {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        {up ? t("botPage.long") : t("botPage.short")}
      </span>

      <span
        className="col-span-2 font-mono text-xs text-text-secondary md:col-span-1 md:text-right"
        title={`${formatNumber(op.entryPrice, { decimals: pair?.pricePrecision ?? 2 })} → ${formatNumber(op.exitPrice, { decimals: pair?.pricePrecision ?? 2 })}`}
      >
        {formatNumber(op.exitPrice, { decimals: pair?.pricePrecision ?? 2 })}
      </span>

      <span className="font-mono text-text-secondary md:text-right">
        ${formatNumber(op.volume, { decimals: 0 })}
      </span>

      <span
        className={cn(
          "font-mono md:text-right",
          positive ? "text-success" : "text-danger",
        )}
      >
        {positive ? "+" : ""}
        {(op.pnlBps / 100).toFixed(2)}%
        <span className="ml-1 hidden text-text-muted lg:inline">
          (${formatNumber(profit, { decimals: 0 })})
        </span>
      </span>

      <span className="hidden font-mono text-xs text-text-muted md:block md:text-right">
        <RelativeTime ts={op.executedAt} />
      </span>

      <div className="col-span-2 flex justify-end md:col-span-1">
        <span
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            op.network === "BSC"
              ? "bg-warning/15 text-warning"
              : "bg-info/15 text-info",
          )}
        >
          {networkLabel(op.network)}
        </span>
      </div>
    </li>
  );
}

function RelativeTime({ ts }: { ts: number }) {
  const { t } = useI18n();
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  if (sec < 60) return <>{t("botPage.secondsAgo", { n: sec })}</>;
  const min = Math.floor(sec / 60);
  if (min < 60) return <>{t("botPage.minutesAgo", { n: min })}</>;
  const hr = Math.floor(min / 60);
  return <>{t("botPage.hoursAgo", { n: hr })}</>;
}

function FeedSkeleton() {
  return (
    <ul className="divide-y divide-border-subtle">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="h-6 w-6 animate-pulse rounded-full bg-bg-hover" />
          <div className="h-4 flex-1 animate-pulse rounded bg-bg-hover" />
        </li>
      ))}
    </ul>
  );
}
