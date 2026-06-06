"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PAIRS } from "@/lib/market/pairs";
import {
  normalizeBotTxHash,
  pickReferenceTxHash,
} from "@/lib/bot/reference-txs";

export type BotNetwork = "BSC" | "POLYGON";
export type BotDirection = "UP" | "DOWN";

export interface BotOperation {
  id: string;
  pair: string;
  direction: BotDirection;
  volume: number;
  pnlBps: number;
  network: BotNetwork;
  fakeTxHash: string;
  executedAt: number;
}

export type BotCadence = "fast" | "normal" | "slow";

const CADENCE_MS: Record<BotCadence, number> = {
  fast: 6_000,
  normal: 12_000,
  slow: 24_000,
};

interface BotState {
  operations: BotOperation[];
  cadence: BotCadence;
  running: boolean;

  setCadence: (c: BotCadence) => void;
  setRunning: (v: boolean) => void;
  pushOperation: () => BotOperation;
  seedInitial: (n?: number) => void;
  reset: () => void;
}

const initial = {
  operations: [] as BotOperation[],
  cadence: "normal" as BotCadence,
  running: true,
};

function makeId(): string {
  return `bot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function randomOp(): BotOperation {
  const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
  const direction: BotDirection = Math.random() > 0.48 ? "UP" : "DOWN";
  const volume = Math.round((5_000 + Math.random() * 95_000) / 100) * 100;
  const pnlBps = Math.round((Math.random() - 0.35) * 800);
  const network: BotNetwork = Math.random() > 0.55 ? "BSC" : "POLYGON";
  const id = makeId();
  return {
    id,
    pair: pair.binance,
    direction,
    volume,
    pnlBps,
    network,
    fakeTxHash: pickReferenceTxHash(network, id),
    executedAt: Date.now(),
  };
}

function normalizeOperations(ops: BotOperation[]): BotOperation[] {
  return ops.map((op) => ({
    ...op,
    fakeTxHash: normalizeBotTxHash(op.network, op.id, op.fakeTxHash),
  }));
}

export const useBotStore = create<BotState>()(
  persist(
    (set, get) => ({
      ...initial,

      setCadence: (cadence) => set({ cadence }),
      setRunning: (running) => set({ running }),

      pushOperation: () => {
        const op = randomOp();
        set((s) => ({
          operations: [op, ...s.operations].slice(0, 80),
        }));
        return op;
      },

      seedInitial: (n = 12) => {
        const prev = get().operations;
        const normalized = normalizeOperations(prev);
        const migrated = normalized.some(
          (op, i) => op.fakeTxHash !== prev[i]?.fakeTxHash,
        );
        if (migrated) set({ operations: normalized });

        const count = migrated ? normalized.length : prev.length;
        if (count >= n) return;

        const ops = [...(migrated ? normalized : prev)];
        for (let i = ops.length; i < n; i += 1) {
          const op = randomOp();
          op.executedAt = Date.now() - i * 45_000;
          ops.push(op);
        }
        set({ operations: ops });
      },

      reset: () => set(initial),
    }),
    {
      name: "valtrix.bot.v2",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : window.localStorage,
      ),
      partialize: (s) => ({
        operations: s.operations,
        cadence: s.cadence,
        running: s.running,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.operations?.length) return;
        state.operations = normalizeOperations(state.operations);
      },
    },
  ),
);

export function useBotStoreHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const unsub = useBotStore.persist.onFinishHydration(() => setHydrated(true));
    if (useBotStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

/** Company profit = sum of positive notionals from bot P/L. */
export function botProfitUsd(op: BotOperation): number {
  return Math.max(0, (op.volume * op.pnlBps) / 10_000);
}

export function useCompanyProfits() {
  const operations = useBotStore((s) => s.operations);
  return React.useMemo(() => {
    const now = Date.now();
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const weekStart = dayStart.getTime() - 6 * 86_400_000;

    let today = 0;
    let week = 0;
    let allTime = 0;

    for (const op of operations) {
      const p = botProfitUsd(op);
      allTime += p;
      if (op.executedAt >= weekStart) week += p;
      if (op.executedAt >= dayStart.getTime()) today += p;
    }

    return { today, week, allTime };
  }, [operations]);
}

export function useBotFeedEngine(): void {
  const hydrated = useBotStoreHydrated();
  const running = useBotStore((s) => s.running);
  const cadence = useBotStore((s) => s.cadence);
  const seedInitial = useBotStore((s) => s.seedInitial);
  const push = useBotStore((s) => s.pushOperation);

  React.useEffect(() => {
    if (!hydrated) return;
    seedInitial(14);
  }, [hydrated, seedInitial]);

  React.useEffect(() => {
    if (!hydrated || !running) return;
    const ms = CADENCE_MS[cadence];
    const id = window.setInterval(() => push(), ms);
    return () => window.clearInterval(id);
  }, [hydrated, running, cadence, push]);
}

export { CADENCE_MS };
