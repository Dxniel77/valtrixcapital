import type { Candle, Ticker } from "@/lib/market/types";
import type { Timeframe } from "@/lib/market/pairs";
import { getBybitCredentials } from "./credentials";
import { exchangeFetch } from "./http";

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
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
}

function bybitHeaders(): HeadersInit {
  const { apiKey } = getBybitCredentials();
  return apiKey ? { "X-BAPI-API-KEY": apiKey } : {};
}

export async function fetchBybitKlines(
  symbol: string,
  timeframe: Timeframe,
  limit = 300,
): Promise<Candle[]> {
  const interval = BYBIT_INTERVAL[timeframe];
  const url = `${REST_BASE}/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await exchangeFetch(url, bybitHeaders());
  if (!res.ok) throw new Error(`Bybit klines failed: ${res.status}`);
  const json = await res.json();
  const list = (json?.result?.list ?? []) as BybitKlineItem[];
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

export async function fetchBybitTicker(symbol: string): Promise<Ticker> {
  const url = `${REST_BASE}/v5/market/tickers?category=spot&symbol=${symbol}`;
  const res = await exchangeFetch(url, bybitHeaders());
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
