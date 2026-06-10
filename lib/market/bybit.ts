import type { Candle, Ticker } from "./types";
import { BINANCE_INTERVAL, type MarketSource, type Timeframe } from "./pairs";

/** Bybit REST klines via authenticated server proxy. */
export async function fetchKlinesBybit(
  symbol: string,
  timeframe: Timeframe,
  limit = 300,
): Promise<{ candles: Candle[]; source: MarketSource }> {
  const params = new URLSearchParams({
    symbol,
    timeframe,
    limit: String(limit),
    source: "bybit",
  });
  const res = await fetch(`/api/market/klines?${params}`, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Bybit klines failed: ${res.status}`);
  }
  return res.json() as Promise<{ candles: Candle[]; source: MarketSource }>;
}

export async function fetchTickerBybit(
  symbol: string,
): Promise<{ ticker: Ticker; source: MarketSource }> {
  const params = new URLSearchParams({ symbol, source: "bybit" });
  const res = await fetch(`/api/market/ticker?${params}`, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Bybit ticker failed: ${res.status}`);
  }
  return res.json() as Promise<{ ticker: Ticker; source: MarketSource }>;
}

export { BINANCE_INTERVAL };
