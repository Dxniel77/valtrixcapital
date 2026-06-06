"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  CrosshairMode,
  LineStyle,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/market/types";
import { emaSeriesFromCandles } from "@/lib/market/indicators";
import type { ChartIndicatorState } from "@/components/trade/chart-indicators";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PriceMarker {
  price: number;
  color: string;
  title: string;
  lineStyle?: LineStyle;
}

interface TradingChartProps {
  symbol: string;
  timeframe: string;
  candles: Candle[];
  livePrice?: number;
  precision?: number;
  pairLabel?: string;
  timeframeLabel?: string;
  priceLines?: PriceMarker[];
  indicators?: ChartIndicatorState;
  className?: string;
  height?: number;
}

export interface TradingChartHandle {
  resetZoom: () => void;
}

interface ChartPalette {
  up: string;
  down: string;
  upVolume: string;
  downVolume: string;
  text: string;
  grid: string;
  crosshair: string;
  crosshairLabel: string;
  lastPriceLine: string;
}

interface OhlcvDisplay {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function getPalette(isDark: boolean): ChartPalette {
  if (isDark) {
    return {
      up: "#26C6DA",
      down: "#FF6B6B",
      upVolume: "rgba(38,198,218,0.35)",
      downVolume: "rgba(255,107,107,0.35)",
      text: "#787B86",
      grid: "rgba(255,255,255,0.05)",
      crosshair: "rgba(255,255,255,0.25)",
      crosshairLabel: "#26C6DA",
      lastPriceLine: "#26C6DA",
    };
  }
  return {
    up: "#00A896",
    down: "#E85D5D",
    upVolume: "rgba(0,168,150,0.28)",
    downVolume: "rgba(232,93,93,0.28)",
    text: "#6B7280",
    grid: "rgba(0,0,0,0.06)",
    crosshair: "rgba(0,0,0,0.2)",
    crosshairLabel: "#00A896",
    lastPriceLine: "#00A896",
  };
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

/** Initial zoom: show a short recent window (large candles), not all 300 bars. */
const INITIAL_VISIBLE_BARS: Record<string, number> = {
  "1m": 78,
  "5m": 72,
  "15m": 56,
  "1h": 48,
  "4h": 42,
  "1D": 30,
};

function getInitialVisibleBars(timeframe: string, totalBars: number): number {
  const target = INITIAL_VISIBLE_BARS[timeframe] ?? 72;
  return Math.min(target, Math.max(totalBars - 1, 24));
}

function OhlcvBar({
  pairLabel,
  timeframeLabel,
  ohlcv,
  precision,
  palette,
}: {
  pairLabel?: string;
  timeframeLabel?: string;
  ohlcv: OhlcvDisplay | null;
  precision: number;
  palette: ChartPalette;
}) {
  if (!ohlcv) return null;
  const up = ohlcv.close >= ohlcv.open;

  const fields: { key: keyof OhlcvDisplay; label: string; format: (v: number) => string }[] =
    [
      { key: "open", label: "O", format: (v) => formatNumber(v, { decimals: precision }) },
      { key: "high", label: "H", format: (v) => formatNumber(v, { decimals: precision }) },
      { key: "low", label: "L", format: (v) => formatNumber(v, { decimals: precision }) },
      { key: "close", label: "C", format: (v) => formatNumber(v, { decimals: precision }) },
      { key: "volume", label: "V", format: formatVolume },
    ];

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-bg-base/70 px-2.5 py-1.5 font-mono text-[11px] backdrop-blur-sm">
      {(pairLabel || timeframeLabel) && (
        <span className="text-text-secondary">
          {pairLabel}
          {timeframeLabel ? ` · ${timeframeLabel}` : ""}
        </span>
      )}
      {fields.map(({ key, label, format }) => (
        <span key={key} className="inline-flex items-center gap-1">
          <span style={{ color: palette.up }}>{label}</span>
          <span
            className={key === "close" ? undefined : "text-text-primary"}
            style={key === "close" ? { color: up ? palette.up : palette.down } : undefined}
          >
            {format(ohlcv[key])}
          </span>
        </span>
      ))}
    </div>
  );
}

export const TradingChart = React.forwardRef<
  TradingChartHandle,
  TradingChartProps
>(function TradingChart(
  {
    symbol,
    timeframe,
    candles,
    livePrice,
    precision = 2,
    pairLabel,
    timeframeLabel,
    priceLines,
    indicators = { volume: true, ema20: true, ema50: false },
    className,
    height,
  },
  ref,
) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const seriesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = React.useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = React.useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = React.useRef<ISeriesApi<"Line"> | null>(null);
  const linesRef = React.useRef<IPriceLine[]>([]);
  const paletteRef = React.useRef<ChartPalette>(getPalette(isDark));
  const candlesRef = React.useRef<Candle[]>(candles);

  const dataEpochRef = React.useRef(0);
  const viewEpochRef = React.useRef(0);
  const prevCandleCountRef = React.useRef(0);
  const prevLastTimeRef = React.useRef<number | null>(null);
  const programmaticViewRef = React.useRef(false);
  const pendingFitRef = React.useRef(false);
  const pendingBarCountRef = React.useRef(0);
  const loadedSymbolRef = React.useRef<string | null>(null);

  const [ohlcv, setOhlcv] = React.useState<OhlcvDisplay | null>(null);

  const lastCandle = candles[candles.length - 1];
  const displayOhlcv = React.useMemo((): OhlcvDisplay | null => {
    if (!lastCandle) return null;
    const close =
      typeof livePrice === "number" && livePrice > 0 ? livePrice : lastCandle.close;
    return {
      open: lastCandle.open,
      high: Math.max(lastCandle.high, close),
      low: Math.min(lastCandle.low, close),
      close,
      volume: lastCandle.volume,
    };
  }, [lastCandle, livePrice]);

  const applyInitialChartView = React.useCallback(() => {
    const chart = chartRef.current;
    const barCount = pendingBarCountRef.current;
    if (!chart || barCount === 0) return;

    const visible = getInitialVisibleBars(timeframe, barCount);
    programmaticViewRef.current = true;
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, barCount - visible),
      to: barCount + 4,
    });
    programmaticViewRef.current = false;
    pendingFitRef.current = false;
  }, [timeframe]);

  React.useImperativeHandle(ref, () => ({
    resetZoom: () => {
      const barCount = candlesRef.current.length;
      if (barCount === 0) return;
      pendingBarCountRef.current = barCount;
      applyInitialChartView();
    },
  }));

  const scheduleInitialChartView = React.useCallback((barCount: number) => {
    pendingBarCountRef.current = barCount;
    pendingFitRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyInitialChartView();
      });
    });
  }, [applyInitialChartView]);

  const applyInitialChartViewRef = React.useRef(applyInitialChartView);
  applyInitialChartViewRef.current = applyInitialChartView;

  // Reset when pair / dataset identity changes
  React.useEffect(() => {
    dataEpochRef.current += 1;
    viewEpochRef.current = 0;
    prevCandleCountRef.current = 0;
    prevLastTimeRef.current = null;
    loadedSymbolRef.current = null;
    pendingFitRef.current = true;
    setOhlcv(null);

    const series = seriesRef.current;
    const volume = volumeRef.current;
    if (series && volume) {
      series.setData([]);
      volume.setData([]);
    }
  }, [symbol, timeframe]);

  // Init chart (once per mount)
  React.useEffect(() => {
    if (!containerRef.current) return;
    const palette = getPalette(isDark);
    paletteRef.current = palette;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: palette.text,
        fontFamily:
          "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: palette.grid },
      },
      rightPriceScale: {
        borderVisible: false,
        textColor: palette.text,
        scaleMargins: { top: 0.12, bottom: 0.28 },
        entireTextOnly: true,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 10,
        minBarSpacing: 6,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: palette.crosshair,
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: palette.crosshairLabel,
        },
        horzLine: {
          color: palette.crosshair,
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: palette.crosshairLabel,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: palette.up,
      downColor: palette.down,
      borderVisible: false,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineStyle: LineStyle.Dotted,
      priceLineColor: palette.lastPriceLine,
      lastValueVisible: true,
      priceFormat: {
        type: "price",
        precision,
        minMove: Math.pow(10, -precision),
      },
    });

    const volume = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.88, bottom: 0 },
    });

    const ema20 = chart.addLineSeries({
      color: "#F97316",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: indicators.ema20,
    });

    const ema50 = chart.addLineSeries({
      color: "#A855F7",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: indicators.ema50,
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      if (!programmaticViewRef.current) {
        viewEpochRef.current = dataEpochRef.current;
      }
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !seriesRef.current) return;
      const bar = param.seriesData.get(seriesRef.current) as
        | CandlestickData<Time>
        | undefined;
      if (!bar || typeof bar.open !== "number") return;
      const vol = candlesRef.current.find((c) => c.time === param.time);
      setOhlcv({
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: vol?.volume ?? 0,
      });
    });

    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;
    ema20Ref.current = ema20;
    ema50Ref.current = ema50;

    const ro = new ResizeObserver(() => {
      if (!pendingFitRef.current) return;
      applyInitialChartViewRef.current();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      ema20Ref.current = null;
      ema50Ref.current = null;
      linesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const volume = volumeRef.current;
    if (!chart || !series || !volume) return;

    const palette = getPalette(isDark);
    paletteRef.current = palette;

    chart.applyOptions({
      layout: { textColor: palette.text },
      grid: { horzLines: { color: palette.grid } },
      rightPriceScale: { textColor: palette.text },
      crosshair: {
        vertLine: {
          color: palette.crosshair,
          labelBackgroundColor: palette.crosshairLabel,
        },
        horzLine: {
          color: palette.crosshair,
          labelBackgroundColor: palette.crosshairLabel,
        },
      },
    });

    series.applyOptions({
      upColor: palette.up,
      downColor: palette.down,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
      priceLineColor: palette.lastPriceLine,
    });

    const data = candlesRef.current;
    if (data.length > 0) {
      volume.setData(
        data.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? palette.upVolume : palette.downVolume,
        })),
      );
    }
  }, [isDark]);

  React.useEffect(() => {
    seriesRef.current?.applyOptions({
      priceFormat: {
        type: "price",
        precision,
        minMove: Math.pow(10, -precision),
      },
    });
  }, [precision]);

  // Sync candles — preserve zoom only within the same symbol dataset
  React.useEffect(() => {
    candlesRef.current = candles;
    const series = seriesRef.current;
    const volume = volumeRef.current;
    const chart = chartRef.current;
    if (!series || !volume || !chart) return;

    if (candles.length === 0) return;

    const palette = paletteRef.current;
    const last = candles[candles.length - 1];
    const prevCount = prevCandleCountRef.current;
    const prevLastTime = prevLastTimeRef.current;
    const symbolChanged = loadedSymbolRef.current !== symbol;
    const canRestoreView =
      !symbolChanged &&
      viewEpochRef.current === dataEpochRef.current &&
      viewEpochRef.current > 0;
    const savedRange = canRestoreView
      ? chart.timeScale().getVisibleLogicalRange()
      : null;

    const volPoint = (c: Candle) => ({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? palette.upVolume : palette.downVolume,
    });

    const isLastBarUpdate =
      !symbolChanged &&
      prevCount > 0 &&
      candles.length === prevCount &&
      last.time === prevLastTime;

    const isNewBar =
      !symbolChanged &&
      prevCount > 0 &&
      candles.length === prevCount + 1 &&
      prevLastTime !== null &&
      last.time > prevLastTime;

    if (isLastBarUpdate) {
      series.update({
        time: last.time as UTCTimestamp,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      });
      volume.update(volPoint(last));
    } else if (isNewBar) {
      series.update({
        time: last.time as UTCTimestamp,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      });
      volume.update(volPoint(last));
    } else {
      series.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
      volume.setData(candles.map(volPoint));
      loadedSymbolRef.current = symbol;

      setOhlcv({
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
        volume: last.volume,
      });

      programmaticViewRef.current = true;
      if (savedRange) {
        chart.timeScale().setVisibleLogicalRange(savedRange);
        pendingFitRef.current = false;
      } else {
        scheduleInitialChartView(candles.length);
      }
      programmaticViewRef.current = false;
    }

    prevCandleCountRef.current = candles.length;
    prevLastTimeRef.current = last.time;

    syncIndicatorSeries(candles, indicators);
  }, [candles, symbol, scheduleInitialChartView, indicators]);

  React.useEffect(() => {
    syncIndicatorSeries(candlesRef.current, indicators);
  }, [indicators]);

  function syncIndicatorSeries(
    data: Candle[],
    ind: ChartIndicatorState,
  ) {
    const volume = volumeRef.current;
    const ema20 = ema20Ref.current;
    const ema50 = ema50Ref.current;
    const chart = chartRef.current;
    if (!volume || !ema20 || !ema50 || !chart) return;

    volume.applyOptions({ visible: ind.volume });
    ema20.applyOptions({ visible: ind.ema20 });
    ema50.applyOptions({ visible: ind.ema50 });

    chart.priceScale("volume").applyOptions({
      scaleMargins: ind.volume ? { top: 0.88, bottom: 0 } : { top: 0.98, bottom: 0 },
    });
    chart.priceScale("right").applyOptions({
      scaleMargins: { top: 0.12, bottom: ind.volume ? 0.28 : 0.08 },
    });

    ema20.setData(
      ind.ema20 && data.length >= 20
        ? emaSeriesFromCandles(data, 20)
        : [],
    );
    ema50.setData(
      ind.ema50 && data.length >= 50
        ? emaSeriesFromCandles(data, 50)
        : [],
    );
  }

  React.useEffect(() => {
    if (typeof livePrice !== "number" || livePrice <= 0) return;
    if (!seriesRef.current || candles.length === 0) return;
    const last = candles[candles.length - 1];
    seriesRef.current.update({
      time: last.time as UTCTimestamp,
      open: last.open,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
      close: livePrice,
    });
  }, [livePrice, candles]);

  React.useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    for (const line of linesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        /* noop */
      }
    }
    linesRef.current = [];
    if (!priceLines) return;
    for (const m of priceLines) {
      const ln = series.createPriceLine({
        price: m.price,
        color: m.color,
        lineWidth: 1,
        lineStyle: m.lineStyle ?? LineStyle.Dashed,
        axisLabelVisible: true,
        title: m.title,
      });
      linesRef.current.push(ln);
    }
  }, [priceLines]);

  return (
    <div
      className={cn("relative w-full", height == null && "h-full", className)}
      style={height != null ? { height } : undefined}
    >
      <OhlcvBar
        pairLabel={pairLabel}
        timeframeLabel={timeframeLabel}
        ohlcv={displayOhlcv}
        precision={precision}
        palette={paletteRef.current}
      />
      <div ref={containerRef} className="h-full w-full touch-pan-y" />
    </div>
  );
});
