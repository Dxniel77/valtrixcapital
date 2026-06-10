import type { Candle, Ticker } from "@/lib/market/types";
import type { Timeframe } from "@/lib/market/pairs";
import { exchangeFetch } from "./http";

const REST_BASE = "https://api.gateio.ws/api/v4";

const GATE_INTERVAL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1D": "1d",
};

type GateCandle = [string, string, string, string, string, string, string, string];

function toGatePair(symbol: string): string {
  if (symbol.endsWith("USDT")) {
    return `${symbol.slice(0, -4)}_USDT`;
  }
  return symbol;
}

export async function fetchGateKlines(
  symbol: string,
  timeframe: Timeframe,
  limit = 300,
): Promise<Candle[]> {
  const pair = toGatePair(symbol);
  const interval = GATE_INTERVAL[timeframe];
  const url = `${REST_BASE}/spot/candlesticks?currency_pair=${pair}&interval=${interval}&limit=${limit}`;
  const res = await exchangeFetch(url);
  if (!res.ok) {
    throw new Error(`Gate klines failed: ${res.status}`);
  }
  const data = (await res.json()) as GateCandle[];
  return data
    .map((k) => ({
      time: parseInt(k[0], 10),
      open: parseFloat(k[5]),
      high: parseFloat(k[3]),
      low: parseFloat(k[4]),
      close: parseFloat(k[2]),
      volume: parseFloat(k[1]),
    }))
    .sort((a, b) => a.time - b.time);
}

export async function fetchGateTicker(symbol: string): Promise<Ticker> {
  const pair = toGatePair(symbol);
  const url = `${REST_BASE}/spot/tickers?currency_pair=${pair}`;
  const res = await exchangeFetch(url);
  if (!res.ok) {
    throw new Error(`Gate ticker failed: ${res.status}`);
  }
  const data = (await res.json()) as Array<{
    currency_pair: string;
    last: string;
    change_percentage: string;
    quote_volume: string;
  }>;
  const row = data[0];
  if (!row) throw new Error("No Gate ticker data");
  return {
    symbol,
    price: parseFloat(row.last),
    changePct: parseFloat(row.change_percentage),
    volume: parseFloat(row.quote_volume),
    ts: Date.now(),
  };
}
