import type { Candle, Ticker } from "@/lib/market/types";
import { BINANCE_INTERVAL, type Timeframe } from "@/lib/market/pairs";
import { getBinanceCredentials } from "./credentials";

const REST_BASE = "https://api.binance.com";

interface BinanceKline {
  0: number;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
}

function binanceHeaders(): HeadersInit {
  const { apiKey } = getBinanceCredentials();
  return apiKey ? { "X-MBX-APIKEY": apiKey } : {};
}

export async function fetchBinanceKlines(
  symbol: string,
  timeframe: Timeframe,
  limit = 300,
): Promise<Candle[]> {
  const interval = BINANCE_INTERVAL[timeframe];
  const url = `${REST_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: binanceHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Binance klines failed: ${res.status}`);
  }
  const data = (await res.json()) as BinanceKline[];
  return data.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

export async function fetchBinanceTicker24h(symbol: string): Promise<Ticker> {
  const url = `${REST_BASE}/api/v3/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: binanceHeaders(),
  });
  if (!res.ok) throw new Error(`Binance 24hr ticker failed: ${res.status}`);
  const j = await res.json();
  return {
    symbol,
    price: parseFloat(j.lastPrice),
    changePct: parseFloat(j.priceChangePercent),
    volume: parseFloat(j.quoteVolume),
    ts: Date.now(),
  };
}
