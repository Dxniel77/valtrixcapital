import type { Candle, Ticker } from "./types";
import { BINANCE_INTERVAL, type MarketSource, type Timeframe } from "./pairs";
import { streamBybitSymbol } from "./bybit-ws";
import type { StreamEvent, StreamHandle, StreamOptions } from "./stream-types";

export type { StreamEvent, StreamHandle, StreamOptions } from "./stream-types";

const BINANCE_WS_BASE = "wss://stream.binance.com:9443/stream";

interface BinanceWsKline {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
  x: boolean;
}

interface BinanceWsTicker {
  c: string;
  P: string;
  q: string;
  E: number;
  s: string;
  e?: string;
  k?: BinanceWsKline;
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

export function streamBinanceSymbol(
  symbol: string,
  timeframe: Timeframe,
  onEvent: (e: StreamEvent) => void,
  options: StreamOptions = {},
): StreamHandle {
  const interval = BINANCE_INTERVAL[timeframe];
  const lower = symbol.toLowerCase();
  const streams = `${lower}@kline_${interval}/${lower}@ticker`;
  const url = `${BINANCE_WS_BASE}?streams=${streams}`;
  const connectTimeoutMs = options.connectTimeoutMs ?? 8_000;
  const reconnect = options.reconnect ?? true;

  let ws: WebSocket | null = null;
  let closed = false;
  let connected = false;
  let retryDelay = 1_000;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;

  function clearConnectTimer() {
    if (connectTimer) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
  }

  function connect() {
    if (closed) return;
    connected = false;
    clearConnectTimer();

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

    connectTimer = setTimeout(() => {
      if (connected || closed) return;
      try {
        ws?.close();
      } catch {
        /* noop */
      }
      ws = null;
      onEvent({ type: "error", message: "Binance connection timeout" });
    }, connectTimeoutMs);

    ws.onopen = () => {
      connected = true;
      clearConnectTimer();
      retryDelay = 1_000;
      onEvent({ type: "open", source: "binance" });
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as {
          stream?: string;
          data?: BinanceWsTicker;
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
        /* ignore malformed */
      }
    };

    ws.onerror = () => {
      onEvent({ type: "error", message: "WebSocket error" });
    };

    ws.onclose = () => {
      clearConnectTimer();
      const wasConnected = connected;
      connected = false;
      onEvent({ type: "close" });
      if (!closed && reconnect && wasConnected) schedule();
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
      clearConnectTimer();
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

/**
 * Live market stream with Binance → Bybit fallback and connection timeouts.
 * When all WebSocket sources fail, callers should start REST polling.
 */
export function streamSymbol(
  symbol: string,
  timeframe: Timeframe,
  onEvent: (e: StreamEvent) => void,
  preferredSource?: MarketSource | null,
): StreamHandle {
  let closed = false;
  let active: StreamHandle | null = null;
  let liveSource: MarketSource | null = null;

  const order: MarketSource[] =
    preferredSource === "bybit"
      ? ["bybit", "binance"]
      : preferredSource === "gate"
        ? ["bybit", "binance"]
        : ["binance", "bybit"];

  let index = 0;

  function startNext(failedSource?: MarketSource) {
    if (closed) return;

    if (failedSource && liveSource === failedSource) {
      liveSource = null;
    }

    if (index >= order.length) {
      onEvent({ type: "error", message: "All live feeds unavailable" });
      return;
    }

    const source = order[index++];
    active?.close();

    const handler = (e: StreamEvent) => {
      if (closed) return;

      if (e.type === "open") {
        liveSource = source;
        onEvent({ type: "open", source });
        return;
      }

      if (e.type === "error") {
        if (!liveSource) {
          active?.close();
          active = null;
          startNext(source);
          return;
        }
        onEvent(e);
        return;
      }

      if (e.type === "close") {
        if (liveSource === source) {
          liveSource = null;
        }
        onEvent(e);
        return;
      }

      onEvent(e);
    };

    const opts: StreamOptions = {
      connectTimeoutMs: 8_000,
      reconnect: true,
    };

    active =
      source === "bybit"
        ? streamBybitSymbol(symbol, timeframe, handler, opts)
        : streamBinanceSymbol(symbol, timeframe, handler, opts);
  }

  startNext();

  return {
    close: () => {
      closed = true;
      active?.close();
      active = null;
    },
  };
}
