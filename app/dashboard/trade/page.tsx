"use client";

import * as React from "react";
import { LineStyle } from "lightweight-charts";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  TradingChart,
  type TradingChartHandle,
} from "@/components/trade/trading-chart";
import {
  ChartIndicators,
  loadStoredIndicators,
  saveStoredIndicators,
  type ChartIndicatorState,
} from "@/components/trade/chart-indicators";
import { ChartDrawingToolbar } from "@/components/trade/chart-drawing-toolbar";
import { ChartDrawingOverlay } from "@/components/trade/chart-drawing-overlay";
import type { ChartCoordsApi } from "@/components/trade/trading-chart";
import {
  loadDrawings,
  loadDrawingToolbarVisible,
  saveDrawings,
  saveDrawingToolbarVisible,
  type ChartDrawing,
  type DrawingTool,
} from "@/lib/trade/chart-drawings";
import { PairSelector } from "@/components/trade/pair-selector";
import { TimeframeSelector } from "@/components/trade/timeframe-selector";
import { TradeQuickBar } from "@/components/trade/trade-quick-bar";
import { TradeYieldSummary } from "@/components/trade/trade-yield-summary";
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
import {
  Activity,
  WifiOff,
  Loader2,
  History,
  ChevronsRight,
  PencilLine,
} from "lucide-react";
import Link from "next/link";

export default function TradePage() {
  const { t } = useI18n();
  const chartRef = React.useRef<TradingChartHandle>(null);
  const [pair, setPair] = React.useState<PairMeta>(DEFAULT_PAIR);
  const [timeframe, setTimeframe] = React.useState<Timeframe>(DEFAULT_TIMEFRAME);
  const [duration, setDuration] = React.useState(60);
  const [indicators, setIndicators] = React.useState<ChartIndicatorState>(() =>
    loadStoredIndicators(),
  );
  const [drawingTool, setDrawingTool] = React.useState<DrawingTool>("cursor");
  const [drawings, setDrawings] = React.useState<ChartDrawing[]>([]);
  const [drawingToolbarOpen, setDrawingToolbarOpen] = React.useState(false);
  const [coordsApi, setCoordsApi] = React.useState<ChartCoordsApi | null>(null);
  const skipToolbarSaveRef = React.useRef(true);

  React.useEffect(() => {
    setDrawingToolbarOpen(loadDrawingToolbarVisible());
    skipToolbarSaveRef.current = false;
  }, []);

  React.useEffect(() => {
    if (skipToolbarSaveRef.current) return;
    saveDrawingToolbarVisible(drawingToolbarOpen);
  }, [drawingToolbarOpen]);

  React.useEffect(() => {
    saveStoredIndicators(indicators);
  }, [indicators]);

  React.useEffect(() => {
    setDrawings(loadDrawings(pair.binance, timeframe));
    setDrawingTool("cursor");
  }, [pair.binance, timeframe]);

  React.useEffect(() => {
    saveDrawings(pair.binance, timeframe, drawings);
  }, [drawings, pair.binance, timeframe]);

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
    <div className="space-y-4 lg:space-y-5">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <div className="surface-card overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-border-subtle px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                  <PairSelector
                    active={pair}
                    source={stream.source}
                    tickers={tickers}
                    onChange={setPair}
                  />
                  <PairHeader
                    pair={pair}
                    price={livePrice}
                    ticker={ticker ?? null}
                    compact
                  />
                </div>
                <TimeframeSelector value={timeframe} onChange={setTimeframe} />
              </div>
            </div>

            <ChartIndicators
              value={indicators}
              onChange={setIndicators}
              onResetZoom={() => chartRef.current?.resetZoom()}
            />

            <div className="relative h-[min(52vh,380px)] min-h-[260px] bg-bg-base/40 sm:min-h-[300px] lg:h-[420px]">
              {drawingToolbarOpen ? (
                <ChartDrawingToolbar
                  tool={drawingTool}
                  onToolChange={setDrawingTool}
                  drawingCount={drawings.length}
                  onUndo={() => setDrawings((prev) => prev.slice(0, -1))}
                  onClearAll={() => setDrawings([])}
                  onHide={() => {
                    setDrawingTool("cursor");
                    setDrawingToolbarOpen(false);
                  }}
                  className="absolute left-2 top-2 z-20"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setDrawingToolbarOpen(true)}
                  title={t("trade.drawing.showToolbar")}
                  aria-label={t("trade.drawing.showToolbar")}
                  className="absolute left-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated/90 text-text-muted backdrop-blur-sm transition-colors hover:bg-bg-base/80 hover:text-gold"
                >
                  <PencilLine className="h-4 w-4" />
                  <ChevronsRight className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 text-gold/80" />
                </button>
              )}
              <TradingChart
                ref={chartRef}
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
                indicators={indicators}
                drawingMode={drawingTool !== "cursor"}
                onCoordsApi={setCoordsApi}
                className="h-full"
              />
              <ChartDrawingOverlay
                tool={drawingTool}
                drawings={drawings}
                onDrawingsChange={setDrawings}
                coordsApi={coordsApi}
                className="absolute inset-0 z-10 h-full w-full"
              />
              <PositionCloseCountdown
                pairSymbol={pair.binance}
                livePrice={livePrice}
              />
              <ChartOverlay state={stream.status} />
            </div>

            <TradeQuickBar
              pair={pair}
              livePrice={livePrice}
              duration={duration}
              onDurationChange={setDuration}
            />
          </div>

          <OpenPositions
            currentPair={pair.binance}
            livePrice={livePrice}
            prices={priceMap}
          />

          <ResolvedTradesPreview />

          <div className="lg:hidden">
            <DailyAttempts />
          </div>
        </div>

        <aside className="hidden space-y-4 lg:block">
          <div className="sticky top-20 space-y-4">
            <DailyAttempts />
            <TradeYieldSummary />
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
  compact = false,
}: {
  pair: PairMeta;
  price: number | null;
  ticker: { price: number; changePct: number } | null;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const up = (ticker?.changePct ?? 0) >= 0;
  return (
    <div className="flex items-end gap-3">
      <div>
        {!compact ? (
          <p className="font-mono text-sm text-text-secondary">
            {pair.base}/{pair.quote}
          </p>
        ) : null}
        <p
          className={
            compact
              ? "font-mono text-lg text-text-primary sm:text-xl"
              : "font-mono text-2xl text-text-primary"
          }
        >
          {price !== null
            ? formatNumber(price, { decimals: pair.pricePrecision })
            : "—"}
        </p>
      </div>
      <div className="pb-0.5 text-xs">
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
              className="grid grid-cols-2 items-center gap-2 px-4 py-2 text-xs sm:grid-cols-5"
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
              <span className="hidden font-mono text-text-secondary sm:block">
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
              <span className="hidden font-mono text-text-muted sm:block">
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
