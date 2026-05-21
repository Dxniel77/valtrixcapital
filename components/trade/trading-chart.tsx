"use client";

import * as React from "react";
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

interface PriceMarker {
  price: number;
  color: string;
  title: string;
  lineStyle?: LineStyle;
}

interface TradingChartProps {
  candles: Candle[];
  livePrice?: number;
  precision?: number;
  /** Horizontal markers drawn on the price scale (entry lines, etc.). */
  priceLines?: PriceMarker[];
  className?: string;
  height?: number;
}

export function TradingChart({
  candles,
  livePrice,
  precision = 2,
  priceLines,
  className,
  height = 460,
}: TradingChartProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const seriesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = React.useRef<ISeriesApi<"Histogram"> | null>(null);
  const linesRef = React.useRef<IPriceLine[]>([]);

  // Init chart
  React.useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#9CA0AB",
        fontFamily:
          "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(35,38,47,0.45)" },
        horzLines: { color: "rgba(35,38,47,0.45)" },
      },
      rightPriceScale: {
        borderColor: "rgba(35,38,47,0.8)",
        textColor: "#9CA0AB",
        scaleMargins: { top: 0.08, bottom: 0.24 },
      },
      timeScale: {
        borderColor: "rgba(35,38,47,0.8)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(212,175,55,0.4)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#D4AF37",
        },
        horzLine: {
          color: "rgba(212,175,55,0.4)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#D4AF37",
        },
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
      priceFormat: {
        type: "price",
        precision,
        minMove: Math.pow(10, -precision),
      },
    });

    const volume = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "rgba(212,175,55,0.35)",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      linesRef.current = [];
    };
    // precision is captured at mount time; consumers should re-mount via key when changing precision
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update precision when prop changes
  React.useEffect(() => {
    seriesRef.current?.applyOptions({
      priceFormat: {
        type: "price",
        precision,
        minMove: Math.pow(10, -precision),
      },
    });
  }, [precision]);

  // Push full candle set
  React.useEffect(() => {
    if (!seriesRef.current || !volumeRef.current) return;
    if (candles.length === 0) return;
    const candleData: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(candleData);
    volumeRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color:
          c.close >= c.open
            ? "rgba(34,197,94,0.25)"
            : "rgba(239,68,68,0.25)",
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Apply price lines
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

  // Live last-price update (only updates last candle's close)
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

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height }}
    />
  );
}
