import type { Candle, Ticker } from "./types";
import { BINANCE_INTERVAL, type Timeframe } from "./pairs";

const REST_BASE = "https://api.bybit.com";

const BYBIT_INTERVAL: Record<Timeframe, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1D": "D",
};

interface BybitKlineItem {
  // [startTime, open, high, low, close, volume, turnover] (strings)
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
}

/** Bybit fallback REST klines. Used when Binance REST is geo-blocked. */
export async function fetchKlinesBybit(
  symbol: string,
  timeframe: Timeframe,
  limit = 300,
): Promise<Candle[]> {
  const interval = BYBIT_INTERVAL[timeframe];
  const url = `${REST_BASE}/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Bybit klines failed: ${res.status}`);
  const json = await res.json();
  const list = (json?.result?.list ?? []) as BybitKlineItem[];
  // Bybit returns descending by time — sort ascending.
  return list
    .map((k) => ({
      time: Math.floor(parseInt(k[0], 10) / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }))
    .sort((a, b) => a.time - b.time);
}

export async function fetchTickerBybit(symbol: string): Promise<Ticker> {
  const url = `${REST_BASE}/v5/market/tickers?category=spot&symbol=${symbol}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Bybit ticker failed: ${res.status}`);
  const json = await res.json();
  const t = json?.result?.list?.[0];
  if (!t) throw new Error("No ticker data");
  return {
    symbol,
    price: parseFloat(t.lastPrice),
    changePct: parseFloat(t.price24hPcnt) * 100,
    volume: parseFloat(t.turnover24h),
    ts: Date.now(),
  };
}

// Marker so unused-import lint doesn't trip on BINANCE_INTERVAL re-export.
export { BINANCE_INTERVAL };
