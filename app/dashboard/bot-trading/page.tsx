"use client";

import * as React from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bot,
  ExternalLink,
  Pause,
  Play,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import {
  useBotFeedEngine,
  useBotStore,
  useBotStoreHydrated,
  useCompanyProfits,
  botProfitUsd,
  type BotOperation,
} from "@/lib/bot/store";
import { PAIRS } from "@/lib/market/pairs";
import {
  cn,
  explorerName,
  explorerUrl,
  formatNumber,
  networkLabel,
  shortenHash,
} from "@/lib/utils";

export default function BotTradingPage() {
  const { t } = useI18n();
  const hydrated = useBotStoreHydrated();
  const operations = useBotStore((s) => s.operations);
  const running = useBotStore((s) => s.running);
  const setRunning = useBotStore((s) => s.setRunning);
  const profits = useCompanyProfits();

  useBotFeedEngine();

  const winRate = React.useMemo(() => {
    if (operations.length === 0) return 0;
    const wins = operations.filter((o) => o.pnlBps > 0).length;
    return (wins / operations.length) * 100;
  }, [operations]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("botPage.title")}
        actions={
          <Badge variant={running ? "success" : "warning"}>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                running ? "bg-success animate-pulse-soft" : "bg-warning",
              )}
            />
            {running ? t("botPage.live") : t("botPage.paused")}
          </Badge>
        }
      />

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t("botPage.feedTitle")}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={running ? "outline" : "primary"}
                size="sm"
                onClick={() => setRunning(!running)}
              >
                {running ? (
                  <>
                    <Pause className="h-3.5 w-3.5" /> {t("botPage.pause")}
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> {t("botPage.resume")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="hidden grid-cols-[1.1fr_0.8fr_1fr_0.9fr_0.8fr_1fr] gap-3 border-b border-border-subtle px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted md:grid">
            <span>{t("botPage.colPair")}</span>
            <span>{t("botPage.colDirection")}</span>
            <span className="text-right">{t("botPage.colVolume")}</span>
            <span className="text-right">{t("botPage.colPnl")}</span>
            <span className="text-right">{t("botPage.colTime")}</span>
            <span className="text-right">{t("botPage.colTx")}</span>
          </div>
          {!hydrated ? (
            <FeedSkeleton />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {operations.map((op, idx) => (
                <BotRow key={op.id} op={op} isNewest={idx === 0 && running} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
        "grid grid-cols-2 items-center gap-3 px-3 py-2.5 text-sm md:grid-cols-[1.1fr_0.8fr_1fr_0.9fr_0.8fr_1fr]",
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

      <div className="col-span-2 flex flex-col items-end gap-1 md:col-span-1">
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
        <a
          href={explorerUrl(op.network, op.fakeTxHash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center justify-end gap-1 font-mono text-xs text-text-secondary hover:text-gold"
          title={`${explorerName(op.network)} · ${op.fakeTxHash}`}
        >
          <span className="truncate">{shortenHash(op.fakeTxHash)}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
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
