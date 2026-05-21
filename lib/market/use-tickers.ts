"use client";

import * as React from "react";

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

/**
 * Subscribes to Binance miniTicker for a set of symbols.
 * Returns a map of `BINANCE_SYMBOL -> { price, changePct }`.
 */
export function useTickers(symbols: string[]): Record<string, MiniTicker | undefined> {
  const [tickers, setTickers] = React.useState<Record<string, MiniTicker>>({});
  const symbolsKey = React.useMemo(() => symbols.slice().sort().join(","), [symbols]);

  React.useEffect(() => {
    if (symbols.length === 0) return;
    const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 1000;

    function connect() {
      if (closed) return;
      try {
        ws = new WebSocket(url);
      } catch {
        setTimeout(connect, Math.min(retry, 30_000));
        retry = Math.min(retry * 2, 30_000);
        return;
      }
      ws.onmessage = (ev) => {
        try {
          const wrapped = JSON.parse(ev.data) as BinanceStreamWrapped;
          const items = Array.isArray(wrapped.data) ? wrapped.data : [wrapped.data];
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
      ws.onclose = () => {
        if (closed) return;
        setTimeout(connect, Math.min(retry, 30_000));
        retry = Math.min(retry * 2, 30_000);
      };
      ws.onerror = () => {
        ws?.close();
      };
      ws.onopen = () => {
        retry = 1000;
      };
    }

    connect();
    return () => {
      closed = true;
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  return tickers;
}
