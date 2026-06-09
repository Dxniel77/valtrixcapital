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

export function calculateSma(closes: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < closes.length; i += 1) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      sum += closes[j]!;
    }
    out.push(sum / period);
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

export function smaSeriesFromCandles(
  candles: Candle[],
  period: number,
): { time: UTCTimestamp; value: number }[] {
  if (candles.length < period) return [];
  const closes = candles.map((c) => c.close);
  const sma = calculateSma(closes, period);
  return candles
    .map((c, i) => ({
      time: c.time as UTCTimestamp,
      value: sma[i]!,
    }))
    .filter((p) => Number.isFinite(p.value));
}

export function bollingerSeriesFromCandles(
  candles: Candle[],
  period = 20,
  stdDev = 2,
): {
  upper: { time: UTCTimestamp; value: number }[];
  middle: { time: UTCTimestamp; value: number }[];
  lower: { time: UTCTimestamp; value: number }[];
} {
  if (candles.length < period) {
    return { upper: [], middle: [], lower: [] };
  }
  const closes = candles.map((c) => c.close);
  const sma = calculateSma(closes, period);
  const upper: { time: UTCTimestamp; value: number }[] = [];
  const middle: { time: UTCTimestamp; value: number }[] = [];
  const lower: { time: UTCTimestamp; value: number }[] = [];

  for (let i = period - 1; i < candles.length; i += 1) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = sma[i]!;
    const variance =
      slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    const time = candles[i]!.time as UTCTimestamp;
    middle.push({ time, value: mean });
    upper.push({ time, value: mean + stdDev * sd });
    lower.push({ time, value: mean - stdDev * sd });
  }

  return { upper, middle, lower };
}

export function rsiSeriesFromCandles(
  candles: Candle[],
  period = 14,
): { time: UTCTimestamp; value: number }[] {
  if (candles.length < period + 1) return [];
  const closes = candles.map((c) => c.close);
  const out: { time: UTCTimestamp; value: number }[] = [];

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = closes[i]! - closes[i - 1]!;
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  const pushRsi = (idx: number) => {
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
    out.push({ time: candles[idx]!.time as UTCTimestamp, value: rsi });
  };

  pushRsi(period);

  for (let i = period + 1; i < closes.length; i += 1) {
    const change = closes[i]! - closes[i - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    pushRsi(i);
  }

  return out;
}
