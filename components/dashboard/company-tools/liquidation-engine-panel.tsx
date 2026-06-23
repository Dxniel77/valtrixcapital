"use client";

import * as React from "react";
import {
  Activity,
  Cpu,
  Layers,
  TrendingUp,
} from "lucide-react";

import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CompanyFeedCardHeader,
  CompanyFeedNetworkBadge,
  CompanyFeedNumericCell,
  CompanyFeedPairCell,
  CompanyFeedRow,
  CompanyFeedSkeleton,
  CompanyFeedTableHeader,
  CompanyFeedTimeCell,
  CompanyFeedTxCell,
  COMPANY_FEED_LIST_CLASS,
  formatFeedUsd,
  LIQUIDATION_FEED_GRID,
  type FeedTimeLabels,
} from "@/components/dashboard/company-tools/company-tools-feed-table";
import { useI18n } from "@/lib/i18n/context";
import {
  useLiquidationProfits,
  useLiquidationStore,
  useLiquidationStoreHydrated,
  type LiquidationEvent,
} from "@/lib/liquidation-engine/store";
import { PAIRS } from "@/lib/market/pairs";
import {
  useActivePairsToday,
  useLiveLiquidationToday,
} from "@/lib/company-tools/combined-profits";
import { cn, formatNumber } from "@/lib/utils";

export function LiquidationEnginePanel() {
  const { t } = useI18n();
  const hydrated = useLiquidationStoreHydrated();
  const events = useLiquidationStore((s) => s.events);
  const profits = useLiquidationProfits();
  const liveToday = useLiveLiquidationToday();
  const activePairsToday = useActivePairsToday();

  const timeLabels = React.useMemo<FeedTimeLabels>(
    () => ({
      secondsAgo: (n) => t("liquidationPage.secondsAgo", { n }),
      minutesAgo: (n) => t("liquidationPage.minutesAgo", { n }),
      hoursAgo: (n) => t("liquidationPage.hoursAgo", { n }),
    }),
    [t],
  );

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
          value={`$${formatNumber(liveToday, { decimals: 2 })}`}
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

      <div className="rounded-lg border border-border-subtle bg-bg-base/40 px-4 py-3">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">
          {t("liquidationPage.pairsToday")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PAIRS.map((pair) => {
            const active = activePairsToday.includes(pair.binance);
            return (
              <span
                key={pair.binance}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-mono",
                  active
                    ? "border-gold/30 bg-gold/10 text-gold"
                    : "border-border-subtle text-text-muted",
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: pair.color }}
                  aria-hidden
                />
                {pair.base}/USDT
              </span>
            );
          })}
        </div>
      </div>

      <Card>
        <CompanyFeedCardHeader title={t("liquidationPage.feedTitle")} />
        <CardContent>
          <CompanyFeedTableHeader gridClass={LIQUIDATION_FEED_GRID}>
            <span>{t("liquidationPage.colPair")}</span>
            <span className="text-right">{t("liquidationPage.colAmount")}</span>
            <span className="text-right">{t("liquidationPage.colFee")}</span>
            <span className="text-right">{t("liquidationPage.colNetwork")}</span>
            <span className="text-right">{t("liquidationPage.colTime")}</span>
            <span className="text-right">{t("liquidationPage.colTx")}</span>
          </CompanyFeedTableHeader>
          {!hydrated ? (
            <CompanyFeedSkeleton />
          ) : events.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-text-muted">
              {t("liquidationPage.emptyFeed")}
            </p>
          ) : (
            <ul className={COMPANY_FEED_LIST_CLASS}>
              {events.map((ev, idx) => (
                <LiquidationRow
                  key={ev.id}
                  ev={ev}
                  isNewest={idx === 0}
                  timeLabels={timeLabels}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LiquidationRow({
  ev,
  isNewest,
  timeLabels,
}: {
  ev: LiquidationEvent;
  isNewest: boolean;
  timeLabels: FeedTimeLabels;
}) {
  const { t } = useI18n();
  const pair = PAIRS.find((p) => p.binance === ev.pair);

  return (
    <CompanyFeedRow gridClass={LIQUIDATION_FEED_GRID} isNewest={isNewest}>
      <CompanyFeedPairCell pair={pair} symbol={ev.pair} />

      <CompanyFeedNumericCell
        mobileSpan
        title={t("liquidationPage.onChainAmount")}
      >
        {formatFeedUsd(ev.amountUsdt, 2)}
      </CompanyFeedNumericCell>

      <CompanyFeedNumericCell className="text-success">
        {formatFeedUsd(ev.feeUsd, 3, true)}
      </CompanyFeedNumericCell>

      <span className="hidden md:block md:text-right">
        <CompanyFeedNetworkBadge network={ev.network} />
      </span>

      <CompanyFeedTimeCell ts={ev.executedAt} labels={timeLabels} />

      <CompanyFeedTxCell network={ev.network} txHash={ev.txHash} />
    </CompanyFeedRow>
  );
}
