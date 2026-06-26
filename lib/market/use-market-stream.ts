"use client";

import * as React from "react";
import type { Candle, Ticker } from "./types";
import { fetchKlines, streamSymbol } from "./binance";
import { fetchTickerBybit } from "./bybit";
import type { Timeframe } from "./pairs";
import type { MarketSource } from "./pairs";
import { startTickerPoll } from "./rest-poll";

export interface MarketStreamState {
  /** Symbol the current candles belong to (empty candles while switching). */
  activeSymbol: string;
  candles: Candle[];
  livePrice: number | null;
  ticker: Ticker | null;
  status: "idle" | "connecting" | "live" | "error";
  source: MarketSource | null;
  error: string | null;
}

const WS_FALLBACK_POLL_MS = 12_000;

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
    let historyLoaded = false;
    let wsLive = false;
    let pollStop: (() => void) | null = null;
    let resolvedSource: MarketSource | null = null;

    setState({
      activeSymbol: symbol,
      candles: [],
      livePrice: null,
      ticker: null,
      status: "connecting",
      source: null,
      error: null,
    });

    function stopPoll() {
      pollStop?.();
      pollStop = null;
    }

    function startPoll() {
      if (pollStop || aborted) return;
      pollStop = startTickerPoll(
        symbol,
        resolvedSource,
        (ticker, source) => {
          if (aborted) return;
          setState((s) => ({
            ...s,
            ticker,
            livePrice: ticker.price,
            source: source ?? s.source,
            status: "live",
          }));
        },
        4_000,
      );
    }

    (async () => {
      try {
        const { candles, source } = await fetchKlines(symbol, timeframe, 300);
        if (aborted) return;
        const tickerResult =
          source === "bybit"
            ? await fetchTickerBybit(symbol).catch(() => null)
            : null;
        if (aborted) return;
        historyLoaded = true;
        resolvedSource = source;
        setState((s) => ({
          ...s,
          candles,
          livePrice:
            candles[candles.length - 1]?.close ??
            tickerResult?.ticker.price ??
            null,
          ticker: tickerResult?.ticker ?? null,
          source,
          status: "live",
        }));
      } catch (err) {
        if (aborted) return;
        setState((s) => ({
          ...s,
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load market data",
        }));
      }
    })();

    const handle = streamSymbol(symbol, timeframe, (e) => {
        if (aborted) return;
        if (e.type === "open") {
          wsLive = true;
          stopPoll();
          setState((s) => ({
            ...s,
            status: "live",
            source: e.source,
          }));
        } else if (e.type === "close") {
          if (wsLive) {
            wsLive = false;
            setState((s) => ({
              ...s,
              status: historyLoaded ? "live" : "connecting",
            }));
            startPoll();
          }
        } else if (e.type === "error") {
          if (!wsLive && e.message === "All live feeds unavailable") {
            startPoll();
            if (historyLoaded) {
              setState((s) => ({ ...s, status: "live" }));
            }
          }
        } else if (e.type === "candle") {
          if (!historyLoaded) return;
          setState((s) => {
            const last = s.candles[s.candles.length - 1];
            if (!last) {
              return { ...s, candles: [e.candle], livePrice: e.candle.close };
            }
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

    const fallbackTimer = setTimeout(() => {
      if (aborted || wsLive) return;
      startPoll();
      if (historyLoaded) {
        setState((s) => ({ ...s, status: "live" }));
      }
    }, WS_FALLBACK_POLL_MS);

    return () => {
      aborted = true;
      clearTimeout(fallbackTimer);
      stopPoll();
      handle.close();
    };
  }, [symbol, timeframe]);

  return state;
}
