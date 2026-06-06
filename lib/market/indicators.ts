import type { UTCTimestamp } from "lightweight-charts";
import type { Candle } from "./types";

export function calculateEma(closes: number[], period: number): number[] {
  if (closes.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [closes[0]!];
  for (let i = 1; i < closes.length; i += 1) {
    out.push(closes[i]! * k + out[i - 1]! * (1 - k));
  }
  return out;
}

export function emaSeriesFromCandles(
  candles: Candle[],
  period: number,
): { time: UTCTimestamp; value: number }[] {
  if (candles.length < period) return [];
  const closes = candles.map((c) => c.close);
  const ema = calculateEma(closes, period);
  return candles.map((c, i) => ({
    time: c.time as UTCTimestamp,
    value: ema[i]!,
  }));
}
