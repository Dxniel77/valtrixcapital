"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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

export interface TradeState {
  positions: Position[];
  // Bookkeeping for daily reset
  utcDay: string;

  openPosition: (input: {
    pair: string;
    direction: TradeDirection;
    entryPrice: number;
    durationSec: number;
  }) => Position;

  resolvePosition: (id: string, exitPrice: number) => void;

  rolloverIfNewDay: () => void;

  reset: () => void;
}

export const MAX_TRADES_PER_DAY = 7;
export const BASE_YIELD_BPS = 30;
export const BONUS_PER_WIN_BPS = 10;
export const MAX_DAILY_YIELD_BPS = 100;

export function utcDayKey(ts = Date.now()): string {
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
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
  wins: number;
  losses: number;
  baseRateBps: number;
  bonusRateBps: number;
  totalRateBps: number;
}

/** React hook that returns a memoized daily summary derived from the store. */
export function useDailySummary(): DailySummary {
  const positions = useTradeStore((s) => s.positions);
  return React.useMemo(() => deriveDailySummary(positions), [positions]);
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
export function deriveDailySummary(positions: Position[]): DailySummary {
  const today = utcDayKey();
  const todays = positions.filter((p) => utcDayKey(p.openedAt) === today);
  const wins = todays.filter((p) => p.status === "WIN").length;
  const losses = todays.filter((p) => p.status === "LOSS").length;
  const attemptsUsed = todays.length;
  const attemptsRemaining = Math.max(MAX_TRADES_PER_DAY - attemptsUsed, 0);
  const bonusRateBps = wins * BONUS_PER_WIN_BPS;
  const totalRateBps = Math.min(
    BASE_YIELD_BPS + bonusRateBps,
    MAX_DAILY_YIELD_BPS,
  );
  return {
    attemptsUsed,
    attemptsRemaining,
    wins,
    losses,
    baseRateBps: BASE_YIELD_BPS,
    bonusRateBps,
    totalRateBps,
  };
}
