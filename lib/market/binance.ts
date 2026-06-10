import type { Candle, Ticker } from "./types";
import { BINANCE_INTERVAL, type MarketSource, type Timeframe } from "./pairs";

const WS_BASE = "wss://stream.binance.com:9443/stream";

interface BinanceWsKline {
  t: number; // start time ms
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
  x: boolean; // closed
}

interface BinanceWsTicker {
  c: string; // last price
  P: string; // 24h % change
  q: string; // 24h quote volume
  E: number; // event time
  s: string; // symbol
}

export async function fetchKlines(
  symbol: string,
  timeframe: Timeframe,
  limit = 300,
): Promise<{ candles: Candle[]; source: MarketSource }> {
  const params = new URLSearchParams({
    symbol,
    timeframe,
    limit: String(limit),
  });
  const res = await fetch(`/api/market/klines?${params}`, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Market klines failed: ${res.status}`);
  }
  return res.json() as Promise<{ candles: Candle[]; source: MarketSource }>;
}

export async function fetchTicker24h(
  symbol: string,
): Promise<{ ticker: Ticker; source: MarketSource }> {
  const params = new URLSearchParams({ symbol });
  const res = await fetch(`/api/market/ticker?${params}`, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Market ticker failed: ${res.status}`);
  }
  return res.json() as Promise<{ ticker: Ticker; source: MarketSource }>;
}

/**
 * Single-symbol stream covering both kline updates and ticker.
 * Auto-reconnects with exponential backoff up to 30s.
 */
export type StreamEvent =
  | { type: "candle"; candle: Candle; closed: boolean }
  | { type: "ticker"; ticker: Ticker }
  | { type: "open" }
  | { type: "close" }
  | { type: "error"; message: string };

export interface StreamHandle {
  close: () => void;
}

export function streamSymbol(
  symbol: string,
  timeframe: Timeframe,
  onEvent: (e: StreamEvent) => void,
): StreamHandle {
  const interval = BINANCE_INTERVAL[timeframe];
  const lower = symbol.toLowerCase();
  const streams = `${lower}@kline_${interval}/${lower}@ticker`;
  const url = `${WS_BASE}?streams=${streams}`;

  let ws: WebSocket | null = null;
  let closed = false;
  let retryDelay = 1000;

  function connect() {
    if (closed) return;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      onEvent({
        type: "error",
        message: err instanceof Error ? err.message : "WS init failed",
      });
      schedule();
      return;
    }

    ws.onopen = () => {
      retryDelay = 1000;
      onEvent({ type: "open" });
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as {
          stream?: string;
          data?: { e?: string; k?: BinanceWsKline } & BinanceWsTicker;
        };
        const data = msg.data;
        if (!data) return;
        if (data.e === "kline" && data.k) {
          const k = data.k;
          const candle: Candle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          };
          onEvent({ type: "candle", candle, closed: !!k.x });
        } else if (data.e === "24hrTicker" || data.c) {
          const t: Ticker = {
            symbol: data.s ?? symbol,
            price: parseFloat(data.c),
            changePct: parseFloat(data.P),
            volume: parseFloat(data.q),
            ts: data.E ?? Date.now(),
          };
          onEvent({ type: "ticker", ticker: t });
        }
      } catch {
        // ignore malformed
      }
    };

    ws.onerror = () => {
      onEvent({ type: "error", message: "WebSocket error" });
    };

    ws.onclose = () => {
      onEvent({ type: "close" });
      schedule();
    };
  }

  function schedule() {
    if (closed) return;
    const delay = Math.min(retryDelay, 30_000);
    retryDelay = Math.min(retryDelay * 2, 30_000);
    setTimeout(connect, delay);
  }

  connect();

  return {
    close: () => {
      closed = true;
      if (ws) {
        try {
          ws.close();
        } catch {
          /* noop */
        }
        ws = null;
      }
    },
  };
}
