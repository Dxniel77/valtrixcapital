"use client";

import * as React from "react";
import { LineStyle } from "lightweight-charts";
import { PageHeader } from "@/components/dashboard/page-header";
import { TradingChart } from "@/components/trade/trading-chart";
import { PairSelector } from "@/components/trade/pair-selector";
import { TimeframeSelector } from "@/components/trade/timeframe-selector";
import { TradePanel } from "@/components/trade/trade-panel";
import { OpenPositions } from "@/components/trade/open-positions";
import { PositionCloseCountdown } from "@/components/trade/position-close-countdown";
import { DailyAttempts } from "@/components/trade/daily-attempts";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_PAIR,
  DEFAULT_TIMEFRAME,
  PAIRS,
  TIMEFRAMES,
  type PairMeta,
  type Timeframe,
} from "@/lib/market/pairs";
import { useMarketStream } from "@/lib/market/use-market-stream";
import { useTickers } from "@/lib/market/use-tickers";
import { useTradeStore, utcDayKey } from "@/lib/trade/store";
import { formatNumber } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { Activity, WifiOff, Loader2, History } from "lucide-react";
import Link from "next/link";

export default function TradePage() {
  const { t } = useI18n();
  const [pair, setPair] = React.useState<PairMeta>(DEFAULT_PAIR);
  const [timeframe, setTimeframe] = React.useState<Timeframe>(DEFAULT_TIMEFRAME);

  const stream = useMarketStream(pair.binance, timeframe);
  const tickers = useTickers(PAIRS.map((p) => p.binance));

  const rolloverIfNewDay = useTradeStore((s) => s.rolloverIfNewDay);
  React.useEffect(() => {
    rolloverIfNewDay();
    const id = setInterval(rolloverIfNewDay, 60_000);
    return () => clearInterval(id);
  }, [rolloverIfNewDay]);

  const positions = useTradeStore((s) => s.positions);

  const priceLines = React.useMemo(() => {
    return positions
      .filter((p) => p.status === "OPEN" && p.pair === pair.binance)
      .map((p) => ({
        price: p.entryPrice,
        color: p.direction === "UP" ? "#26C6DA" : "#FF6B6B",
        title:
          p.direction === "UP"
            ? t("trade.buyEntry")
            : t("trade.sellEntry"),
        lineStyle: LineStyle.Dashed,
      }));
  }, [positions, pair.binance, t]);

  const priceMap = React.useMemo(() => {
    const out: Record<string, number | undefined> = {};
    for (const [sym, tick] of Object.entries(tickers)) {
      out[sym] = tick?.price;
    }
    return out;
  }, [tickers]);

  const ticker = stream.ticker ?? tickers[pair.binance];
  const livePrice = stream.livePrice ?? ticker?.price ?? null;
  const today = utcDayKey();
  const timeframeLabel =
    TIMEFRAMES.find((tf) => tf.value === timeframe)?.label ?? timeframe;

  const statusLabel =
    stream.status === "live"
      ? t("trade.live", { source: stream.source ?? "binance" })
      : stream.status === "connecting"
        ? t("trade.connecting")
        : stream.status === "error"
          ? t("trade.offline")
          : t("trade.idle");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("trade.title")}
        subtitle={t("trade.subtitle", { day: today })}
        actions={
          <Badge variant={stream.status === "live" ? "success" : "warning"}>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                stream.status === "live" ? "bg-success" : "bg-warning"
              }`}
            />
            {statusLabel}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0 space-y-4">
          <div className="surface-card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <PairSelector
                  active={pair}
                  source={stream.source}
                  tickers={tickers}
                  onChange={setPair}
                />
                <PairHeader pair={pair} price={livePrice} ticker={ticker ?? null} />
              </div>
              <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            </div>

            <div className="relative bg-bg-base/40">
              <TradingChart
                symbol={pair.binance}
                timeframe={timeframe}
                candles={
                  stream.activeSymbol === pair.binance ? stream.candles : []
                }
                livePrice={livePrice ?? undefined}
                precision={pair.pricePrecision}
                pairLabel={`${pair.base}/${pair.quote}`}
                timeframeLabel={timeframeLabel}
                priceLines={priceLines}
                height={400}
              />
              <PositionCloseCountdown
                pairSymbol={pair.binance}
                livePrice={livePrice}
              />
              <ChartOverlay state={stream.status} />
            </div>
          </div>

          <OpenPositions
            currentPair={pair.binance}
            livePrice={livePrice}
            prices={priceMap}
          />

          <ResolvedTradesPreview />
        </div>

        <aside className="space-y-4">
          <DailyAttempts />
          <div className="surface-card p-5">
            <TradePanel pair={pair} livePrice={livePrice} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PairHeader({
  pair,
  price,
  ticker,
}: {
  pair: PairMeta;
  price: number | null;
  ticker: { price: number; changePct: number } | null;
}) {
  const { t } = useI18n();
  const up = (ticker?.changePct ?? 0) >= 0;
  return (
    <div className="flex items-end gap-4">
      <div>
        <p className="font-mono text-sm text-text-secondary">
          {pair.base}/{pair.quote}
        </p>
        <p className="font-mono text-2xl text-text-primary">
          {price !== null
            ? formatNumber(price, { decimals: pair.pricePrecision })
            : "—"}
        </p>
      </div>
      <div className="pb-1 text-xs">
        <p className={`font-mono ${up ? "text-success" : "text-danger"}`}>
          {ticker
            ? `${up ? "+" : ""}${ticker.changePct.toFixed(2)}%`
            : "—"}
        </p>
        <p className="text-text-muted">{t("trade.h24")}</p>
      </div>
    </div>
  );
}

function ChartOverlay({
  state,
}: {
  state: "idle" | "connecting" | "live" | "error";
}) {
  const { t } = useI18n();
  if (state === "live") return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg-base/40 backdrop-blur-[1px]">
      <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-elevated/90 px-3 py-2 text-xs text-text-secondary">
        {state === "error" ? (
          <>
            <WifiOff className="h-3.5 w-3.5 text-danger" />
            {t("trade.feedError")}
          </>
        ) : state === "connecting" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
            {t("trade.feedConnecting")}
          </>
        ) : (
          <>
            <Activity className="h-3.5 w-3.5 text-text-muted" />
            {t("trade.idle")}
          </>
        )}
      </div>
    </div>
  );
}

function ResolvedTradesPreview() {
  const { t } = useI18n();
  const positions = useTradeStore((s) => s.positions);
  const today = utcDayKey();
  const recent = React.useMemo(
    () =>
      positions
        .filter((p) => p.status !== "OPEN" && utcDayKey(p.openedAt) === today)
        .slice(0, 5),
    [positions, today],
  );

  if (recent.length === 0) return null;

  return (
    <div className="surface-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("dashboard.pages.history.recentToday")}
        </h3>
        <Link
          href="/dashboard/history"
          className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-gold"
        >
          <History className="h-3 w-3" /> {t("dashboard.pages.history.fullHistory")}
        </Link>
      </header>
      <ul className="divide-y divide-border-subtle">
        {recent.map((p) => {
          const pairInfo = PAIRS.find((x) => x.binance === p.pair);
          const isWin = p.status === "WIN";
          return (
            <li
              key={p.id}
              className="grid grid-cols-5 items-center gap-2 px-4 py-2 text-xs"
            >
              <span className="font-mono text-text-primary">
                {pairInfo?.base ?? p.pair.replace("USDT", "")}/USDT
              </span>
              <span
                className={`font-mono ${
                  p.direction === "UP" ? "text-success" : "text-danger"
                }`}
              >
                {p.direction === "UP" ? t("common.buyArrow") : t("common.sellArrow")}
              </span>
              <span className="font-mono text-text-secondary">
                {formatNumber(p.entryPrice, {
                  decimals: pairInfo?.pricePrecision ?? 2,
                })}{" "}
                →{" "}
                {p.exitPrice
                  ? formatNumber(p.exitPrice, {
                      decimals: pairInfo?.pricePrecision ?? 2,
                    })
                  : "—"}
              </span>
              <span className="font-mono text-text-muted">
                {p.durationSec / 60}m
              </span>
              <span
                className={`justify-self-end rounded-sm px-1.5 py-0.5 text-[10px] ${
                  isWin
                    ? "bg-success/10 text-success"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {isWin ? "+0,10%" : "0,00%"} ·{" "}
                {isWin ? t("common.win") : t("common.loss")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
