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
import {
  bollingerSeriesFromCandles,
  emaSeriesFromCandles,
  rsiSeriesFromCandles,
} from "@/lib/market/indicators";
import type { ChartIndicatorState } from "@/components/trade/chart-indicators";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PriceMarker {
  price: number;
  color: string;
  title: string;
  lineStyle?: LineStyle;
}

export interface ChartCoordsApi {
  timeToX: (time: number) => number | null;
  priceToY: (price: number) => number | null;
  xToTime: (x: number) => number | null;
  yToPrice: (y: number) => number | null;
  subscribeChange: (cb: () => void) => () => void;
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
  drawingMode?: boolean;
  onCoordsApi?: (api: ChartCoordsApi | null) => void;
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

function lineSeriesDefaults(visible: boolean) {
  return {
    lineWidth: 2 as const,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
    visible,
  };
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
    <div className="pointer-events-none absolute left-12 top-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-bg-base/70 px-2.5 py-1.5 font-mono text-[11px] backdrop-blur-sm">
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
    indicators = {
      volume: true,
      ema9: false,
      ema20: true,
      ema50: false,
      ema200: false,
      bollinger: false,
      rsi: false,
    },
    drawingMode = false,
    onCoordsApi,
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
  const ema9Ref = React.useRef<ISeriesApi<"Line"> | null>(null);
  const ema20Ref = React.useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = React.useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref = React.useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef = React.useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleRef = React.useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = React.useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = React.useRef<ISeriesApi<"Line"> | null>(null);
  const linesRef = React.useRef<IPriceLine[]>([]);
  const paletteRef = React.useRef<ChartPalette>(getPalette(isDark));
  const candlesRef = React.useRef<Candle[]>(candles);
  const changeListenersRef = React.useRef(new Set<() => void>());

  const dataEpochRef = React.useRef(0);
  const viewEpochRef = React.useRef(0);
  const prevCandleCountRef = React.useRef(0);
  const prevLastTimeRef = React.useRef<number | null>(null);
  const programmaticViewRef = React.useRef(false);
  const pendingFitRef = React.useRef(false);
  const pendingBarCountRef = React.useRef(0);
  const loadedSymbolRef = React.useRef<string | null>(null);

  const [ohlcv, setOhlcv] = React.useState<OhlcvDisplay | null>(null);

  const notifyChange = React.useCallback(() => {
    for (const cb of changeListenersRef.current) cb();
  }, []);

  const buildCoordsApi = React.useCallback((): ChartCoordsApi => ({
    timeToX: (time: number) => {
      const chart = chartRef.current;
      if (!chart) return null;
      return chart.timeScale().timeToCoordinate(time as Time);
    },
    priceToY: (price: number) => {
      const series = seriesRef.current;
      if (!series) return null;
      return series.priceToCoordinate(price);
    },
    xToTime: (x: number) => {
      const chart = chartRef.current;
      if (!chart) return null;
      const t = chart.timeScale().coordinateToTime(x);
      return t != null ? (t as number) : null;
    },
    yToPrice: (y: number) => {
      const series = seriesRef.current;
      if (!series) return null;
      return series.coordinateToPrice(y);
    },
    subscribeChange: (cb: () => void) => {
      changeListenersRef.current.add(cb);
      return () => changeListenersRef.current.delete(cb);
    },
  }), []);

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
    notifyChange();
  }, [timeframe, notifyChange]);

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

    const ema9 = chart.addLineSeries({
      color: "#22C55E",
      ...lineSeriesDefaults(indicators.ema9),
    });
    const ema20 = chart.addLineSeries({
      color: "#F97316",
      ...lineSeriesDefaults(indicators.ema20),
    });
    const ema50 = chart.addLineSeries({
      color: "#A855F7",
      ...lineSeriesDefaults(indicators.ema50),
    });
    const ema200 = chart.addLineSeries({
      color: "#26C6DA",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: indicators.ema200,
    });
    const bbUpper = chart.addLineSeries({
      color: "rgba(212,175,55,0.9)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: indicators.bollinger,
    });
    const bbMiddle = chart.addLineSeries({
      color: "rgba(212,175,55,0.5)",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: indicators.bollinger,
    });
    const bbLower = chart.addLineSeries({
      color: "rgba(212,175,55,0.9)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: indicators.bollinger,
    });
    const rsi = chart.addLineSeries({
      color: "#EC4899",
      lineWidth: 2,
      priceScaleId: "rsi",
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: indicators.rsi,
    });
    chart.priceScale("rsi").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0.02 },
      borderVisible: false,
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      if (!programmaticViewRef.current) {
        viewEpochRef.current = dataEpochRef.current;
      }
      notifyChange();
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
    ema9Ref.current = ema9;
    ema20Ref.current = ema20;
    ema50Ref.current = ema50;
    ema200Ref.current = ema200;
    bbUpperRef.current = bbUpper;
    bbMiddleRef.current = bbMiddle;
    bbLowerRef.current = bbLower;
    rsiRef.current = rsi;

    onCoordsApi?.(buildCoordsApi());

    const ro = new ResizeObserver(() => {
      notifyChange();
      if (!pendingFitRef.current) return;
      applyInitialChartViewRef.current();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      onCoordsApi?.(null);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      ema9Ref.current = null;
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
      bbUpperRef.current = null;
      bbMiddleRef.current = null;
      bbLowerRef.current = null;
      rsiRef.current = null;
      linesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({
      handleScroll: {
        mouseWheel: !drawingMode,
        pressedMouseMove: !drawingMode,
        horzTouchDrag: !drawingMode,
        vertTouchDrag: !drawingMode,
      },
      handleScale: {
        axisPressedMouseMove: !drawingMode,
        mouseWheel: !drawingMode,
        pinch: !drawingMode,
      },
    });
  }, [drawingMode]);

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
    const countDelta =
      prevCount > 0 ? Math.abs(candles.length - prevCount) : candles.length;
    const isBulkReload =
      symbolChanged || prevCount === 0 || countDelta > 1;
    const canRestoreView =
      !isBulkReload &&
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
      if (isBulkReload) {
        viewEpochRef.current = 0;
      }

      programmaticViewRef.current = true;
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
    notifyChange();
  }, [candles, symbol, scheduleInitialChartView, indicators, notifyChange]);

  React.useEffect(() => {
    syncIndicatorSeries(candlesRef.current, indicators);
  }, [indicators]);

  function applyScaleMargins(ind: ChartIndicatorState) {
    const chart = chartRef.current;
    if (!chart) return;

    const hasVolume = ind.volume;
    const hasRsi = ind.rsi;

    let mainBottom = 0.08;
    if (hasVolume && hasRsi) mainBottom = 0.42;
    else if (hasVolume) mainBottom = 0.28;
    else if (hasRsi) mainBottom = 0.22;

    chart.priceScale("right").applyOptions({
      scaleMargins: { top: 0.1, bottom: mainBottom },
    });

    chart.priceScale("volume").applyOptions({
      visible: hasVolume,
      scaleMargins: hasVolume
        ? hasRsi
          ? { top: 0.6, bottom: 0.22 }
          : { top: 0.88, bottom: 0 }
        : { top: 0.98, bottom: 0 },
    });

    chart.priceScale("rsi").applyOptions({
      visible: hasRsi,
      scaleMargins: hasRsi
        ? { top: 0.82, bottom: 0.02 }
        : { top: 0.98, bottom: 0 },
    });
  }

  function syncIndicatorSeries(data: Candle[], ind: ChartIndicatorState) {
    const volume = volumeRef.current;
    const ema9 = ema9Ref.current;
    const ema20 = ema20Ref.current;
    const ema50 = ema50Ref.current;
    const ema200 = ema200Ref.current;
    const bbUpper = bbUpperRef.current;
    const bbMiddle = bbMiddleRef.current;
    const bbLower = bbLowerRef.current;
    const rsi = rsiRef.current;
    if (
      !volume ||
      !ema9 ||
      !ema20 ||
      !ema50 ||
      !ema200 ||
      !bbUpper ||
      !bbMiddle ||
      !bbLower ||
      !rsi
    ) {
      return;
    }

    volume.applyOptions({ visible: ind.volume });
    ema9.applyOptions({ visible: ind.ema9 });
    ema20.applyOptions({ visible: ind.ema20 });
    ema50.applyOptions({ visible: ind.ema50 });
    ema200.applyOptions({ visible: ind.ema200 });
    bbUpper.applyOptions({ visible: ind.bollinger });
    bbMiddle.applyOptions({ visible: ind.bollinger });
    bbLower.applyOptions({ visible: ind.bollinger });
    rsi.applyOptions({ visible: ind.rsi });

    applyScaleMargins(ind);

    ema9.setData(
      ind.ema9 && data.length >= 9 ? emaSeriesFromCandles(data, 9) : [],
    );
    ema20.setData(
      ind.ema20 && data.length >= 20 ? emaSeriesFromCandles(data, 20) : [],
    );
    ema50.setData(
      ind.ema50 && data.length >= 50 ? emaSeriesFromCandles(data, 50) : [],
    );
    ema200.setData(
      ind.ema200 && data.length >= 200 ? emaSeriesFromCandles(data, 200) : [],
    );

    if (ind.bollinger && data.length >= 20) {
      const bb = bollingerSeriesFromCandles(data);
      bbUpper.setData(bb.upper);
      bbMiddle.setData(bb.middle);
      bbLower.setData(bb.lower);
    } else {
      bbUpper.setData([]);
      bbMiddle.setData([]);
      bbLower.setData([]);
    }

    rsi.setData(
      ind.rsi && data.length >= 15 ? rsiSeriesFromCandles(data) : [],
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
