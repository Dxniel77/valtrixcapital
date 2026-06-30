import { utcDayKey } from "@/lib/trade/constants";
import type { Position } from "@/lib/trade/store";
import {
  computeDailyRate,
  type DailyYield,
  type InstantCredit,
} from "@/lib/staking/store";

export function countTradeWinsForDay(day: string, positions: Position[]): number {
  let wins = 0;
  for (const p of positions) {
    if (utcDayKey(p.openedAt) !== day || p.status === "OPEN") continue;
    if (p.status === "WIN") wins += 1;
  }
  return wins;
}

function winsFromInstantCredits(
  day: string,
  instantCredits: InstantCredit[],
): number {
  return instantCredits.filter(
    (c) => c.type === "TRADE_WIN" && utcDayKey(c.createdAt) === day,
  ).length;
}

export function countTradeLossesForDay(
  day: string,
  positions: Position[],
): number {
  let losses = 0;
  for (const p of positions) {
    if (utcDayKey(p.openedAt) !== day || p.status === "OPEN") continue;
    if (p.status === "LOSS") losses += 1;
  }
  return losses;
}

/**
 * Daily yield records store only the passive base rate (0.3%).
 * Trade-win bonuses (+0.1% each) are credited instantly and must be
 * included when displaying historical bar rates.
 */
export function displayYieldRateBps(
  yieldRow: DailyYield,
  positions: Position[],
  instantCredits: InstantCredit[] = [],
): number {
  let wins = countTradeWinsForDay(yieldRow.date, positions);
  if (wins === 0 && instantCredits.length > 0) {
    wins = winsFromInstantCredits(yieldRow.date, instantCredits);
  }
  return computeDailyRate(wins).totalRateBps;
}

export function displayYieldWins(
  yieldRow: DailyYield,
  positions: Position[],
  instantCredits: InstantCredit[] = [],
): number {
  const fromTrades = countTradeWinsForDay(yieldRow.date, positions);
  const fromCredits =
    fromTrades === 0 && instantCredits.length > 0
      ? winsFromInstantCredits(yieldRow.date, instantCredits)
      : 0;
  return Math.max(yieldRow.wins, fromTrades, fromCredits);
}
