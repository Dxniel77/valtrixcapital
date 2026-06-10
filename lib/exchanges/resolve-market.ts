import { fetchBinanceKlines, fetchBinanceTicker24h } from "./binance";
import { fetchBybitKlines, fetchBybitTicker } from "./bybit";
import { fetchGateKlines, fetchGateTicker } from "./gate";
import type { Candle, Ticker } from "@/lib/market/types";
import type { MarketSource, Timeframe } from "@/lib/market/pairs";

type MarketResult<T> = { data: T; source: MarketSource };

async function firstMarketResult<T>(
  attempts: Array<{
    source: MarketSource;
    run: () => Promise<T>;
  }>,
): Promise<MarketResult<T>> {
  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      const data = await attempt.run();
      return { data, source: attempt.source };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error("All market data providers failed");
}

export async function resolveKlines(
  symbol: string,
  timeframe: Timeframe,
  limit: number,
  preferred?: string | null,
): Promise<MarketResult<Candle[]>> {
  if (preferred === "bybit") {
    return firstMarketResult([
      { source: "bybit", run: () => fetchBybitKlines(symbol, timeframe, limit) },
      { source: "binance", run: () => fetchBinanceKlines(symbol, timeframe, limit) },
      { source: "gate", run: () => fetchGateKlines(symbol, timeframe, limit) },
    ]);
  }

  if (preferred === "gate") {
    return firstMarketResult([
      { source: "gate", run: () => fetchGateKlines(symbol, timeframe, limit) },
      { source: "binance", run: () => fetchBinanceKlines(symbol, timeframe, limit) },
      { source: "bybit", run: () => fetchBybitKlines(symbol, timeframe, limit) },
    ]);
  }

  return firstMarketResult([
    { source: "binance", run: () => fetchBinanceKlines(symbol, timeframe, limit) },
    { source: "gate", run: () => fetchGateKlines(symbol, timeframe, limit) },
    { source: "bybit", run: () => fetchBybitKlines(symbol, timeframe, limit) },
  ]);
}

export async function resolveTicker(
  symbol: string,
  preferred?: string | null,
): Promise<MarketResult<Ticker>> {
  if (preferred === "bybit") {
    return firstMarketResult([
      { source: "bybit", run: () => fetchBybitTicker(symbol) },
      { source: "binance", run: () => fetchBinanceTicker24h(symbol) },
      { source: "gate", run: () => fetchGateTicker(symbol) },
    ]);
  }

  if (preferred === "gate") {
    return firstMarketResult([
      { source: "gate", run: () => fetchGateTicker(symbol) },
      { source: "binance", run: () => fetchBinanceTicker24h(symbol) },
      { source: "bybit", run: () => fetchBybitTicker(symbol) },
    ]);
  }

  return firstMarketResult([
    { source: "binance", run: () => fetchBinanceTicker24h(symbol) },
    { source: "gate", run: () => fetchGateTicker(symbol) },
    { source: "bybit", run: () => fetchBybitTicker(symbol) },
  ]);
}
