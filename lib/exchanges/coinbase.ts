import type { Candle, Ticker } from "@/lib/market/types";
import type { Timeframe } from "@/lib/market/pairs";
import { exchangeFetch } from "./http";

const REST_BASE = "https://api.exchange.coinbase.com";

const COINBASE_GRANULARITY: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 21600,
  "1D": 86400,
};

/** BTCUSDT → BTC-USDT */
export function toCoinbaseProductId(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.endsWith("USDT")) {
    return `${upper.slice(0, -4)}-USDT`;
  }
  if (upper.endsWith("USD")) {
    return `${upper.slice(0, -3)}-USD`;
  }
  return upper;
}

type CoinbaseCandle = [number, number, number, number, number, number];

export async function fetchCoinbaseKlines(
  symbol: string,
  timeframe: Timeframe,
  limit = 300,
): Promise<Candle[]> {
  const productId = toCoinbaseProductId(symbol);
  const granularity = COINBASE_GRANULARITY[timeframe];
  const url = `${REST_BASE}/products/${productId}/candles?granularity=${granularity}`;
  const res = await exchangeFetch(url);
  if (!res.ok) {
    throw new Error(`Coinbase klines failed: ${res.status}`);
  }
  const data = (await res.json()) as CoinbaseCandle[];
  return data
    .map((k) => ({
      time: k[0],
      low: k[1],
      high: k[2],
      open: k[3],
      close: k[4],
      volume: k[5],
    }))
    .sort((a, b) => a.time - b.time)
    .slice(-limit);
}

export async function fetchCoinbaseTicker(symbol: string): Promise<Ticker> {
  const productId = toCoinbaseProductId(symbol);
  const url = `${REST_BASE}/products/${productId}/ticker`;
  const res = await exchangeFetch(url);
  if (!res.ok) {
    throw new Error(`Coinbase ticker failed: ${res.status}`);
  }
  const statsRes = await exchangeFetch(`${REST_BASE}/products/${productId}/stats`);
  if (!statsRes.ok) {
    throw new Error(`Coinbase stats failed: ${statsRes.status}`);
  }
  const ticker = await res.json();
  const stats = await statsRes.json();
  const open = parseFloat(stats.open);
  const price = parseFloat(ticker.price);
  const changePct = open > 0 ? ((price - open) / open) * 100 : 0;
  return {
    symbol,
    price,
    changePct,
    volume: parseFloat(stats.volume),
    ts: Date.now(),
  };
}
