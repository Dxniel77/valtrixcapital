import { STAKE_MIN_USDT } from "@/lib/staking/store";
import type { Position } from "@/lib/trade/store";

/** Minimum capital (USDT) for the lowest simultaneous-trade tier. */
export const SIMULTANEOUS_TIER_LOW_MIN = STAKE_MIN_USDT; // 15

export const SIMULTANEOUS_TIER_MID_MIN = 501;
export const SIMULTANEOUS_TIER_HIGH_MIN = 1001;

export type SimultaneousTier = "none" | "starter" | "growth" | "pro";

export interface SimultaneousLimit {
  max: number;
  tier: SimultaneousTier;
  open: number;
  remaining: number;
}

/** Max concurrent open trades from invested capital (USDT). */
export function maxSimultaneousTrades(capital: number): number {
  if (capital < SIMULTANEOUS_TIER_LOW_MIN) return 0;
  if (capital >= SIMULTANEOUS_TIER_HIGH_MIN) return 7;
  if (capital >= SIMULTANEOUS_TIER_MID_MIN) return 5;
  return 3;
}

export function simultaneousTier(capital: number): SimultaneousTier {
  if (capital < SIMULTANEOUS_TIER_LOW_MIN) return "none";
  if (capital >= SIMULTANEOUS_TIER_HIGH_MIN) return "pro";
  if (capital >= SIMULTANEOUS_TIER_MID_MIN) return "growth";
  return "starter";
}

export function countOpenPositions(positions: Position[]): number {
  return positions.filter((p) => p.status === "OPEN").length;
}

export function hasReachedSimultaneousLimit(
  positions: Position[],
  capital: number,
): boolean {
  return countOpenPositions(positions) >= maxSimultaneousTrades(capital);
}

export function deriveSimultaneousLimit(
  positions: Position[],
  capital: number,
): SimultaneousLimit {
  const max = maxSimultaneousTrades(capital);
  const open = countOpenPositions(positions);
  return {
    max,
    tier: simultaneousTier(capital),
    open,
    remaining: Math.max(max - open, 0),
  };
}
