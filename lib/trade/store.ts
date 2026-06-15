"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { activeCapital, useStakingStore } from "@/lib/staking/store";
import {
  hasReachedDailyTradeLimit,
  hasReachedSimultaneousLimit,
  maxDailyTrades,
} from "@/lib/trade/limits";
import {
  BASE_YIELD_BPS,
  BONUS_PER_WIN_BPS,
  MAX_DAILY_YIELD_BPS,
  MAX_TRADES_PER_DAY,
  utcDayKey,
  type Position,
  type TradeDirection,
  type TradeStatus,
} from "@/lib/trade/constants";

export type { TradeDirection, TradeStatus, Position } from "@/lib/trade/constants";
export {
  BASE_YIELD_BPS,
  BONUS_PER_WIN_BPS,
  MAX_DAILY_YIELD_BPS,
  MAX_TRADES_PER_DAY,
  utcDayKey,
} from "@/lib/trade/constants";

export interface TradeState {
  positions: Position[];
  // Bookkeeping for daily reset
  utcDay: string;

  openPosition: (input: {
    pair: string;
    direction: TradeDirection;
    entryPrice: number;
    durationSec: number;
  }) => Position | null;

  resolvePosition: (id: string, exitPrice: number) => void;

  rolloverIfNewDay: () => void;

  reset: () => void;
}

export function oppositeDirection(
  direction: TradeDirection,
): TradeDirection {
  return direction === "UP" ? "DOWN" : "UP";
}

/** True when an open position on `pair` faces the opposite way (hedge). */
export function hasOppositeOpenPosition(
  positions: Position[],
  pair: string,
  direction: TradeDirection,
): boolean {
  const opposite = oppositeDirection(direction);
  return positions.some(
    (p) => p.status === "OPEN" && p.pair === pair && p.direction === opposite,
  );
}

export function resolveTradeOutcome(
  position: Pick<Position, "direction" | "entryPrice">,
  exitPrice: number,
): "WIN" | "LOSS" {
  const movedUp = exitPrice > position.entryPrice;
  const movedDown = exitPrice < position.entryPrice;
  if (position.direction === "UP") {
    return movedUp ? "WIN" : "LOSS";
  }
  return movedDown ? "WIN" : "LOSS";
}

const initial: Pick<TradeState, "positions" | "utcDay"> = {
  positions: [],
  utcDay: utcDayKey(),
};

export const useTradeStore = create<TradeState>()(
  persist(
    (set, get) => ({
      ...initial,

      openPosition: ({ pair, direction, entryPrice, durationSec }) => {
        get().rolloverIfNewDay();
        if (hasOppositeOpenPosition(get().positions, pair, direction)) {
          return null;
        }
        const capital = activeCapital(useStakingStore.getState().stakes);
        if (hasReachedDailyTradeLimit(get().positions, capital)) {
          return null;
        }
        if (hasReachedSimultaneousLimit(get().positions, capital)) {
          return null;
        }
        const id =
          (globalThis.crypto?.randomUUID?.() as string | undefined) ??
          `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const position: Position = {
          id,
          pair,
          direction,
          entryPrice,
          durationSec,
          openedAt: Date.now(),
          status: "OPEN",
        };
        set((s) => ({ positions: [position, ...s.positions] }));
        return position;
      },

      resolvePosition: (id, exitPrice) => {
        set((s) => ({
          positions: s.positions.map((p) => {
            if (p.id !== id) return p;
            if (p.status !== "OPEN") return p;
            const status = resolveTradeOutcome(p, exitPrice);
            return {
              ...p,
              status,
              exitPrice,
              resolvedAt: Date.now(),
            };
          }),
        }));
      },

      rolloverIfNewDay: () => {
        const today = utcDayKey();
        if (get().utcDay !== today) {
          set({ utcDay: today });
        }
      },

      reset: () => set(initial),
    }),
    {
      name: "valtrix.trade.v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : window.localStorage,
      ),
      partialize: (s) => ({ positions: s.positions, utcDay: s.utcDay }),
    },
  ),
);

// --- Derived selectors ---

export interface DailySummary {
  attemptsUsed: number;
  attemptsRemaining: number;
  maxAttempts: number;
  wins: number;
  losses: number;
  baseRateBps: number;
  bonusRateBps: number;
  totalRateBps: number;
}

/** React hook that returns a memoized daily summary derived from the store. */
export function useDailySummary(): DailySummary {
  const positions = useTradeStore((s) => s.positions);
  const stakes = useStakingStore((s) => s.stakes);
  const capital = activeCapital(stakes);
  return React.useMemo(
    () => deriveDailySummary(positions, capital),
    [positions, capital],
  );
}

/** Returns `true` once Zustand has loaded persisted state from localStorage. */
export function useTradeStoreHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const unsub = useTradeStore.persist.onFinishHydration(() => setHydrated(true));
    if (useTradeStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

/** React hook for currently open positions. */
export function useOpenPositions(): Position[] {
  const positions = useTradeStore((s) => s.positions);
  return React.useMemo(
    () => positions.filter((p) => p.status === "OPEN"),
    [positions],
  );
}

/** Pure derivation — call with a stable positions array. */
export function deriveDailySummary(
  positions: Position[],
  capital: number,
): DailySummary {
  const today = utcDayKey();
  const todays = positions.filter((p) => utcDayKey(p.openedAt) === today);
  const wins = todays.filter((p) => p.status === "WIN").length;
  const losses = todays.filter((p) => p.status === "LOSS").length;
  const attemptsUsed = todays.length;
  const maxAttempts = maxDailyTrades(capital);
  const attemptsRemaining = Math.max(maxAttempts - attemptsUsed, 0);
  const bonusRateBps = wins * BONUS_PER_WIN_BPS;
  const totalRateBps = Math.min(
    BASE_YIELD_BPS + bonusRateBps,
    MAX_DAILY_YIELD_BPS,
  );
  return {
    attemptsUsed,
    attemptsRemaining,
    maxAttempts,
    wins,
    losses,
    baseRateBps: BASE_YIELD_BPS,
    bonusRateBps,
    totalRateBps,
  };
}
