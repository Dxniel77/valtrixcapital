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
import { Card, CardContent } from "@/components/ui/card";
import {
  BOT_FEED_GRID,
  CompanyFeedCardHeader,
  CompanyFeedNetworkBadge,
  CompanyFeedNumericCell,
  CompanyFeedPairCell,
  CompanyFeedRow,
  CompanyFeedSkeleton,
  CompanyFeedTableHeader,
  COMPANY_FEED_LIST_CLASS,
  formatFeedUsd,
} from "@/components/dashboard/company-tools/company-tools-feed-table";
import { useI18n } from "@/lib/i18n/context";
import {
  useBotStore,
  useBotStoreHydrated,
  useCompanyProfits,
  botTradePnlUsd,
  type BotOperation,
} from "@/lib/bot/store";
import { PAIRS } from "@/lib/market/pairs";
import { useTickers } from "@/lib/market/use-tickers";
import { cn, formatNumber } from "@/lib/utils";

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
        <CompanyFeedCardHeader title={t("botPage.feedTitle")} />
        <CardContent>
          <CompanyFeedTableHeader gridClass={BOT_FEED_GRID}>
            <span>{t("botPage.colPair")}</span>
            <span>{t("botPage.colDirection")}</span>
            <span className="text-right">{t("botPage.colPrice")}</span>
            <span className="text-right">{t("botPage.colVolume")}</span>
            <span className="text-right">{t("botPage.colPnl")}</span>
            <span className="text-right">{t("botPage.colNetwork")}</span>
          </CompanyFeedTableHeader>
          {!hydrated ? (
            <CompanyFeedSkeleton />
          ) : operations.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-text-muted">
              {t("botPage.emptyFeed")}
            </p>
          ) : (
            <ul className={COMPANY_FEED_LIST_CLASS}>
              {operations.map((op, idx) => (
                <BotRow key={op.id} op={op} isNewest={idx === 0} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BotRow({
  op,
  isNewest,
}: {
  op: BotOperation;
  isNewest: boolean;
}) {
  const { t } = useI18n();
  const pair = PAIRS.find((p) => p.binance === op.pair);
  const up = op.direction === "UP";
  const pnlUsd = botTradePnlUsd(op);
  const positive = pnlUsd >= 0;
  const priceDecimals = pair?.pricePrecision ?? 2;

  return (
    <CompanyFeedRow gridClass={BOT_FEED_GRID} isNewest={isNewest}>
      <CompanyFeedPairCell pair={pair} symbol={op.pair} />

      <span
        className={cn(
          "inline-flex items-center gap-1 font-mono",
          up ? "text-success" : "text-danger",
        )}
      >
        {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        {up ? t("botPage.long") : t("botPage.short")}
      </span>

      <CompanyFeedNumericCell
        title={formatNumber(op.exitPrice, { decimals: priceDecimals })}
      >
        {formatNumber(op.entryPrice, { decimals: priceDecimals })}
      </CompanyFeedNumericCell>

      <CompanyFeedNumericCell>
        {formatFeedUsd(op.volume, 0)}
      </CompanyFeedNumericCell>

      <CompanyFeedNumericCell
        className={positive ? "text-success" : "text-danger"}
      >
        {positive ? "+" : ""}
        {(op.pnlBps / 100).toFixed(2)}%
        <span className="ml-1.5 text-text-secondary">
          ({formatFeedUsd(pnlUsd, 2, true)})
        </span>
      </CompanyFeedNumericCell>

      <span className="hidden md:block md:text-right">
        <CompanyFeedNetworkBadge network={op.network} />
      </span>
    </CompanyFeedRow>
  );
}
