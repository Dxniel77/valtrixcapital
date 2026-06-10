import type { Candle, Ticker } from "@/lib/market/types";
import { BINANCE_INTERVAL, type Timeframe } from "@/lib/market/pairs";
import { getBinanceCredentials } from "./credentials";
import { exchangeFetch } from "./http";

/** Global market-data host first — api.binance.com is geo-blocked on many US cloud IPs (e.g. Vercel iad1). */
const REST_BASES = [
  process.env.BINANCE_REST_BASE?.trim(),
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
].filter((base): base is string => Boolean(base));

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

async function fetchBinanceJson(path: string): Promise<unknown> {
  let lastError: Error | null = null;
  for (const base of REST_BASES) {
    try {
      const res = await exchangeFetch(`${base}${path}`, binanceHeaders());
      if (!res.ok) {
        lastError = new Error(`Binance request failed: ${res.status} (${base})`);
        continue;
      }
      return res.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error("Binance request failed");
}

export async function fetchBinanceKlines(
  symbol: string,
  timeframe: Timeframe,
  limit = 300,
): Promise<Candle[]> {
  const interval = BINANCE_INTERVAL[timeframe];
  const path = `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const data = (await fetchBinanceJson(path)) as BinanceKline[];
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
  const j = (await fetchBinanceJson(`/api/v3/ticker/24hr?symbol=${symbol}`)) as {
    lastPrice: string;
    priceChangePercent: string;
    quoteVolume: string;
  };
  return {
    symbol,
    price: parseFloat(j.lastPrice),
    changePct: parseFloat(j.priceChangePercent),
    volume: parseFloat(j.quoteVolume),
    ts: Date.now(),
  };
}
