"use client";

import * as React from "react";
import { startMultiTickerPoll } from "./rest-poll";

type MiniTicker = { price: number; changePct: number };

interface BinanceMiniTicker {
  e?: string;
  s: string;
  c: string;
  P: string;
}

interface BinanceStreamWrapped {
  data: BinanceMiniTicker | BinanceMiniTicker[];
}

const WS_CONNECT_TIMEOUT_MS = 8_000;
const WS_FALLBACK_POLL_MS = 10_000;

/**
 * Subscribes to live tickers with Binance WS → REST polling fallback.
 * Returns a map of `BINANCE_SYMBOL -> { price, changePct }`.
 */
export function useTickers(symbols: string[]): Record<string, MiniTicker | undefined> {
  const [tickers, setTickers] = React.useState<Record<string, MiniTicker>>({});
  const symbolsKey = React.useMemo(() => symbols.slice().sort().join(","), [symbols]);

  React.useEffect(() => {
    if (symbols.length === 0) return;

    let ws: WebSocket | null = null;
    let closed = false;
    let wsLive = false;
    let receivedData = false;
    let pollStop: (() => void) | null = null;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    function stopPoll() {
      pollStop?.();
      pollStop = null;
    }

    function startPoll() {
      if (pollStop || closed) return;
      pollStop = startMultiTickerPoll(
        symbols,
        (symbol, ticker) => {
          setTickers((prev) => {
            const entry = {
              price: ticker.price,
              changePct: ticker.changePct,
            };
            if (
              prev[symbol]?.price === entry.price &&
              prev[symbol]?.changePct === entry.changePct
            ) {
              return prev;
            }
            return { ...prev, [symbol]: entry };
          });
        },
        5_000,
      );
    }

    function clearConnectTimer() {
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
    }

    function connectBinance() {
      if (closed) return;
      clearConnectTimer();

      const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join("/");
      const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

      try {
        ws = new WebSocket(url);
      } catch {
        startPoll();
        return;
      }

      connectTimer = setTimeout(() => {
        if (wsLive || closed) return;
        try {
          ws?.close();
        } catch {
          /* noop */
        }
        ws = null;
        startPoll();
      }, WS_CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        wsLive = true;
        clearConnectTimer();
        stopPoll();
      };

      ws.onmessage = (ev) => {
        receivedData = true;
        try {
          const wrapped = JSON.parse(ev.data) as BinanceStreamWrapped;
          const items = Array.isArray(wrapped.data)
            ? wrapped.data
            : [wrapped.data];
          setTickers((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const t of items) {
              if (!t?.s) continue;
              const entry = {
                price: parseFloat(t.c),
                changePct: parseFloat(t.P),
              };
              if (
                !prev[t.s] ||
                prev[t.s].price !== entry.price ||
                prev[t.s].changePct !== entry.changePct
              ) {
                next[t.s] = entry;
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        clearConnectTimer();
        const wasLive = wsLive;
        wsLive = false;
        if (closed) return;
        if (wasLive) {
          setTimeout(connectBinance, 2_000);
        } else {
          startPoll();
        }
      };
    }

    fallbackTimer = setTimeout(() => {
      if (closed || wsLive || receivedData) return;
      startPoll();
    }, WS_FALLBACK_POLL_MS);

    connectBinance();

    return () => {
      closed = true;
      clearConnectTimer();
      if (fallbackTimer) clearTimeout(fallbackTimer);
      stopPoll();
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  return tickers;
}
