export type TradeDirection = "UP" | "DOWN";
export type TradeStatus = "OPEN" | "WIN" | "LOSS";

export interface Position {
  id: string;
  pair: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice?: number;
  durationSec: number;
  openedAt: number; // ms
  resolvedAt?: number;
  status: TradeStatus;
}

export const MAX_TRADES_PER_DAY = 7;
export const BASE_YIELD_BPS = 30;
export const BONUS_PER_WIN_BPS = 10;
export const MAX_DAILY_YIELD_BPS = 100;

export function utcDayKey(ts = Date.now()): string {
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}
