"use client";

import * as React from "react";
import {
  Activity,
  Cpu,
  ExternalLink,
  Layers,
  TrendingUp,
  Zap,
} from "lucide-react";

import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import {
  useLiquidationFeedEngine,
  useLiquidationProfits,
  useLiquidationStore,
  useLiquidationStoreHydrated,
  type LiquidationEvent,
} from "@/lib/liquidation-engine/store";
import { PAIRS } from "@/lib/market/pairs";
import {
  cn,
  explorerName,
  explorerUrl,
  formatNumber,
  networkLabel,
  shortenHash,
} from "@/lib/utils";

export function LiquidationEnginePanel() {
  const { t } = useI18n();
  const hydrated = useLiquidationStoreHydrated();
  const events = useLiquidationStore((s) => s.events);
  const profits = useLiquidationProfits();

  useLiquidationFeedEngine();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Badge variant="success">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
          {t("liquidationPage.live")}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("liquidationPage.feesToday")}
          value={`$${formatNumber(profits.today, { decimals: 2 })}`}
          icon={TrendingUp}
          accent="success"
          hint={t("liquidationPage.feesTodayHint")}
        />
        <StatTile
          label={t("liquidationPage.feesWeek")}
          value={`$${formatNumber(profits.week, { decimals: 2 })}`}
          icon={Activity}
          accent="gold"
          hint={t("liquidationPage.feesWeekHint")}
        />
        <StatTile
          label={t("liquidationPage.feesAllTime")}
          value={`$${formatNumber(profits.allTime, { decimals: 2 })}`}
          icon={Cpu}
          accent="info"
          hint={t("liquidationPage.feesAllTimeHint")}
        />
        <StatTile
          label={t("liquidationPage.processedToday")}
          value={formatNumber(profits.processedToday, { decimals: 0 })}
          icon={Layers}
          accent="silver"
          hint={t("liquidationPage.processedTodayHint")}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>{t("liquidationPage.feedTitle")}</CardTitle>
          <span className="inline-flex items-center gap-1 text-xs text-text-muted">
            <Zap className="h-3.5 w-3.5 text-gold" />
            {t("liquidationPage.verifyHint")}
          </span>
        </CardHeader>
        <CardContent>
          <div className="hidden grid-cols-[1fr_0.8fr_0.9fr_0.8fr_0.7fr_1fr] gap-3 border-b border-border-subtle px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted md:grid">
            <span>{t("liquidationPage.colPair")}</span>
            <span className="text-right">{t("liquidationPage.colAmount")}</span>
            <span className="text-right">{t("liquidationPage.colFee")}</span>
            <span className="text-right">{t("liquidationPage.colNetwork")}</span>
            <span className="text-right">{t("liquidationPage.colTime")}</span>
            <span className="text-right">{t("liquidationPage.colTx")}</span>
          </div>
          {!hydrated ? (
            <FeedSkeleton />
          ) : events.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-text-muted">
              {t("liquidationPage.emptyFeed")}
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {events.map((ev, idx) => (
                <LiquidationRow key={ev.id} ev={ev} isNewest={idx === 0} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-base/40 px-4 py-3 text-xs text-text-muted">
        <p>{t("liquidationPage.feeResetHint")}</p>
        <p>{t("liquidationPage.amountMatchHint")}</p>
      </div>

      <p className="text-xs text-text-muted">{t("liquidationPage.disclaimer")}</p>
    </div>
  );
}

function LiquidationRow({
  ev,
  isNewest,
}: {
  ev: LiquidationEvent;
  isNewest: boolean;
}) {
  const { t } = useI18n();
  const pair = PAIRS.find((p) => p.binance === ev.pair);

  return (
    <li
      className={cn(
        "grid grid-cols-2 items-center gap-3 px-3 py-2.5 text-sm md:grid-cols-[1fr_0.8fr_0.9fr_0.8fr_0.7fr_1fr]",
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
          {pair?.base ?? ev.pair.replace("USDT", "")}/USDT
        </span>
      </div>

      <span
        className="col-span-2 font-mono text-text-primary md:col-span-1 md:text-right"
        title={t("liquidationPage.onChainAmount")}
      >
        ${formatNumber(ev.amountUsdt, { decimals: 2 })}
      </span>

      <span className="font-mono text-success md:text-right">
        +${formatNumber(ev.feeUsd, { decimals: 3 })}
      </span>

      <span className="hidden md:block md:text-right">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] uppercase",
            ev.network === "BSC" ? "text-warning" : "text-info",
          )}
        >
          {networkLabel(ev.network)}
        </Badge>
      </span>

      <span className="hidden font-mono text-xs text-text-muted md:block md:text-right">
        <RelativeTime ts={ev.executedAt} />
      </span>

      <div className="col-span-2 flex flex-col items-end gap-1 md:col-span-1">
        <span className="font-mono text-[10px] text-text-muted md:hidden">
          {networkLabel(ev.network)}
        </span>
        <a
          href={explorerUrl(ev.network, ev.txHash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center justify-end gap-1 font-mono text-xs text-gold hover:text-gold-bright"
          title={`${explorerName(ev.network)} · ${ev.txHash}`}
        >
          <span className="truncate">{shortenHash(ev.txHash)}</span>
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
  if (sec < 60) return <>{t("liquidationPage.secondsAgo", { n: sec })}</>;
  const min = Math.floor(sec / 60);
  if (min < 60) return <>{t("liquidationPage.minutesAgo", { n: min })}</>;
  const hr = Math.floor(min / 60);
  return <>{t("liquidationPage.hoursAgo", { n: hr })}</>;
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
