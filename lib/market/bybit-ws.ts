import type { Candle, Ticker } from "./types";
import type { Timeframe } from "./pairs";
import type { StreamEvent, StreamHandle, StreamOptions } from "./stream-types";

const WS_URL = "wss://stream.bybit.com/v5/public/spot";

const BYBIT_INTERVAL: Record<Timeframe, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1D": "D",
};

interface BybitKlineRow {
  start: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  confirm: boolean;
}

export function streamBybitSymbol(
  symbol: string,
  timeframe: Timeframe,
  onEvent: (e: StreamEvent) => void,
  options: StreamOptions = {},
): StreamHandle {
  const interval = BYBIT_INTERVAL[timeframe];
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
      ws = new WebSocket(WS_URL);
    } catch (err) {
      onEvent({
        type: "error",
        message: err instanceof Error ? err.message : "Bybit WS init failed",
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
      onEvent({ type: "error", message: "Bybit connection timeout" });
    }, connectTimeoutMs);

    ws.onopen = () => {
      connected = true;
      clearConnectTimer();
      retryDelay = 1_000;
      ws?.send(
        JSON.stringify({
          op: "subscribe",
          args: [`kline.${interval}.${symbol}`, `tickers.${symbol}`],
        }),
      );
      onEvent({ type: "open", source: "bybit" });
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as {
          topic?: string;
          data?: BybitKlineRow[] | {
            lastPrice?: string;
            price24hPcnt?: string;
            turnover24h?: string;
          };
        };
        if (!msg.topic || !msg.data) return;

        if (msg.topic.startsWith("kline.")) {
          const rows = msg.data as BybitKlineRow[];
          const k = rows[0];
          if (!k) return;
          const candle: Candle = {
            time: Math.floor(k.start / 1000),
            open: parseFloat(k.open),
            high: parseFloat(k.high),
            low: parseFloat(k.low),
            close: parseFloat(k.close),
            volume: parseFloat(k.volume),
          };
          onEvent({ type: "candle", candle, closed: !!k.confirm });
        } else if (msg.topic.startsWith("tickers.")) {
          const t = msg.data as {
            lastPrice?: string;
            price24hPcnt?: string;
            turnover24h?: string;
          };
          if (!t.lastPrice) return;
          const ticker: Ticker = {
            symbol,
            price: parseFloat(t.lastPrice),
            changePct: parseFloat(t.price24hPcnt ?? "0") * 100,
            volume: parseFloat(t.turnover24h ?? "0"),
            ts: Date.now(),
          };
          onEvent({ type: "ticker", ticker });
        }
      } catch {
        /* ignore malformed */
      }
    };

    ws.onerror = () => {
      onEvent({ type: "error", message: "Bybit WebSocket error" });
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
