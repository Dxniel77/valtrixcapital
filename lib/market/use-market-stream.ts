"use client";

import * as React from "react";
import type { Candle, Ticker } from "./types";
import { fetchKlines, streamSymbol } from "./binance";
import { fetchKlinesBybit, fetchTickerBybit } from "./bybit";
import type { Timeframe } from "./pairs";

export interface MarketStreamState {
  /** Symbol the current candles belong to (empty candles while switching). */
  activeSymbol: string;
  candles: Candle[];
  livePrice: number | null;
  ticker: Ticker | null;
  status: "idle" | "connecting" | "live" | "error";
  source: "binance" | "bybit" | null;
  error: string | null;
}

export function useMarketStream(symbol: string, timeframe: Timeframe) {
  const [state, setState] = React.useState<MarketStreamState>({
    activeSymbol: symbol,
    candles: [],
    livePrice: null,
    ticker: null,
    status: "idle",
    source: null,
    error: null,
  });

  React.useEffect(() => {
    let aborted = false;
    setState({
      activeSymbol: symbol,
      candles: [],
      livePrice: null,
      ticker: null,
      status: "connecting",
      source: null,
      error: null,
    });

    // Load historical candles. Prefer Binance, fallback to Bybit.
    (async () => {
      try {
        const candles = await fetchKlines(symbol, timeframe, 300);
        if (aborted) return;
        setState((s) => ({
          ...s,
          candles,
          livePrice: candles[candles.length - 1]?.close ?? null,
          source: "binance",
        }));
      } catch {
        try {
          const candles = await fetchKlinesBybit(symbol, timeframe, 300);
          if (aborted) return;
          const ticker = await fetchTickerBybit(symbol).catch(() => null);
          if (aborted) return;
          setState((s) => ({
            ...s,
            candles,
            livePrice: candles[candles.length - 1]?.close ?? ticker?.price ?? null,
            ticker,
            source: "bybit",
          }));
        } catch (err) {
          if (aborted) return;
          setState((s) => ({
            ...s,
            status: "error",
            error: err instanceof Error ? err.message : "Failed to load market data",
          }));
        }
      }
    })();

    // Live WS — Binance only (Bybit WS optional, REST fallback is enough for demo)
    const handle = streamSymbol(symbol, timeframe, (e) => {
      if (aborted) return;
      if (e.type === "open") {
        setState((s) => ({ ...s, status: "live", source: s.source ?? "binance" }));
      } else if (e.type === "close" || e.type === "error") {
        setState((s) => ({
          ...s,
          status: s.status === "live" ? "connecting" : s.status,
        }));
      } else if (e.type === "candle") {
        setState((s) => {
          const last = s.candles[s.candles.length - 1];
          if (!last) return { ...s, candles: [e.candle], livePrice: e.candle.close };
          if (e.candle.time === last.time) {
            const next = s.candles.slice(0, -1).concat(e.candle);
            return { ...s, candles: next, livePrice: e.candle.close };
          }
          if (e.candle.time > last.time) {
            const next = [...s.candles, e.candle].slice(-500);
            return { ...s, candles: next, livePrice: e.candle.close };
          }
          return s;
        });
      } else if (e.type === "ticker") {
        setState((s) => ({
          ...s,
          ticker: e.ticker,
          livePrice: e.ticker.price,
        }));
      }
    });

    return () => {
      aborted = true;
      handle.close();
    };
  }, [symbol, timeframe]);

  return state;
}
