"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PAIRS } from "@/lib/market/pairs";
import {
  computeSettlementFee,
  dailyVolumeMultiplier,
} from "@/lib/liquidation-engine/fees";
import type {
  LiquidationCadence,
  LiquidationChainTx,
  LiquidationEvent,
  LiquidationNetwork,
} from "@/lib/liquidation-engine/types";

export type {
  LiquidationCadence,
  LiquidationChainTx,
  LiquidationEvent,
  LiquidationNetwork,
} from "@/lib/liquidation-engine/types";

const CADENCE_MS: Record<LiquidationCadence, number> = {
  fast: 4_000,
  normal: 7_000,
  slow: 12_000,
};

const FEED_MAX = 80;
const FEED_SEED_COUNT = 18;
const FEED_STALE_MS = 6 * 60 * 60 * 1000;
const TX_POOL_REFRESH_MS = 2 * 60 * 1000;
const TX_MAX_AGE_MS = 6 * 60 * 60 * 1000;

interface LiquidationState {
  events: LiquidationEvent[];
  cadence: LiquidationCadence;
  running: boolean;
  dailyFees: Record<string, number>;
  txPool: LiquidationChainTx[];
  txPoolUpdatedAt: number;
  txPoolCursor: number;
  creditedEventIds: string[];
  txsToday: Record<string, number>;

  setCadence: (c: LiquidationCadence) => void;
  setRunning: (v: boolean) => void;
  pushEvent: () => LiquidationEvent | null;
  seedInitial: (n?: number) => void;
  refreshTxPool: () => Promise<void>;
  refreshStaleFeed: () => void;
  reset: () => void;
}

const initial = {
  events: [] as LiquidationEvent[],
  cadence: "normal" as LiquidationCadence,
  running: true,
  dailyFees: {} as Record<string, number>,
  txPool: [] as LiquidationChainTx[],
  txPoolUpdatedAt: 0,
  txPoolCursor: 0,
  creditedEventIds: [] as string[],
  txsToday: {} as Record<string, number>,
};

function makeId(): string {
  return `liq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function utcDateKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function isFreshChainTx(tx: LiquidationChainTx): boolean {
  return Date.now() - tx.executedAt <= TX_MAX_AGE_MS;
}

function isFreshEvent(ev: LiquidationEvent): boolean {
  return Date.now() - ev.executedAt <= FEED_STALE_MS;
}

function pickPairForTx(tx: LiquidationChainTx): string {
  const idx =
    Math.abs(tx.hash.charCodeAt(2) + tx.hash.charCodeAt(5)) % PAIRS.length;
  return PAIRS[idx]?.binance ?? "BTCUSDT";
}

function scaledFee(amountUsdt: number, dayKey: string): number {
  const base = computeSettlementFee(amountUsdt);
  return Math.round(base * dailyVolumeMultiplier(dayKey) * 1000) / 1000;
}

function creditEventFee(
  dailyFees: Record<string, number>,
  creditedEventIds: string[],
  txsToday: Record<string, number>,
  ev: LiquidationEvent,
  feeDay: string,
): {
  dailyFees: Record<string, number>;
  creditedEventIds: string[];
  txsToday: Record<string, number>;
  ev: LiquidationEvent;
} {
  if (creditedEventIds.includes(ev.id)) {
    return { dailyFees, creditedEventIds, txsToday, ev };
  }
  return {
    dailyFees: {
      ...dailyFees,
      [feeDay]: (dailyFees[feeDay] ?? 0) + ev.feeUsd,
    },
    creditedEventIds: [...creditedEventIds, ev.id],
    txsToday: {
      ...txsToday,
      [feeDay]: (txsToday[feeDay] ?? 0) + 1,
    },
    ev: { ...ev, feeDay },
  };
}

function seedExecutedAt(index: number, total: number): number {
  const daysBack = total > 1 ? Math.floor((index / (total - 1)) * 6) : 0;
  const jitterMs = Math.floor(Math.random() * 3_600_000);
  return Date.now() - daysBack * 86_400_000 - jitterMs;
}

function pickChainTx(
  pool: LiquidationChainTx[],
  cursor: number,
  usedHashes: Set<string>,
): { tx: LiquidationChainTx | null; nextCursor: number } {
  const fresh = pool.filter(isFreshChainTx);
  if (fresh.length === 0) return { tx: null, nextCursor: cursor };

  const start = cursor % fresh.length;
  for (let i = 0; i < fresh.length; i += 1) {
    const idx = (start + i) % fresh.length;
    const candidate = fresh[idx]!;
    if (usedHashes.has(candidate.hash)) continue;
    return { tx: candidate, nextCursor: idx + 1 };
  }

  const fallback = fresh[start % fresh.length]!;
  return { tx: fallback, nextCursor: start + 1 };
}

function createEvent(
  state: Pick<LiquidationState, "txPool" | "txPoolCursor" | "events">,
  preferLive = false,
): { ev: LiquidationEvent | null; txPoolCursor: number } {
  if (state.txPool.length === 0) {
    return { ev: null, txPoolCursor: state.txPoolCursor };
  }

  const usedHashes = new Set(state.events.map((e) => e.txHash));
  const { tx, nextCursor } = pickChainTx(
    state.txPool,
    state.txPoolCursor,
    usedHashes,
  );
  if (!tx) return { ev: null, txPoolCursor: state.txPoolCursor };

  const executedAt = preferLive ? Date.now() : tx.executedAt;
  const feeDay = utcDateKey(executedAt);
  const feeUsd = scaledFee(tx.amountUsdt, feeDay);

  const ev: LiquidationEvent = {
    id: makeId(),
    pair: pickPairForTx(tx),
    network: tx.network,
    txHash: tx.hash,
    amountUsdt: tx.amountUsdt,
    feeUsd,
    executedAt,
  };

  return { ev, txPoolCursor: nextCursor };
}

export const useLiquidationStore = create<LiquidationState>()(
  persist(
    (set, get) => ({
      ...initial,

      setCadence: (cadence) => set({ cadence }),
      setRunning: (running) => set({ running }),

      pushEvent: () => {
        const state = get();
        if (state.txPool.length === 0) return null;

        const { ev, txPoolCursor } = createEvent(state, true);
        if (!ev) return null;

        const feeDay = utcDateKey(ev.executedAt);
        const credited = creditEventFee(
          state.dailyFees,
          state.creditedEventIds,
          state.txsToday,
          ev,
          feeDay,
        );

        set((s) => ({
          txPoolCursor,
          dailyFees: credited.dailyFees,
          creditedEventIds: credited.creditedEventIds,
          txsToday: credited.txsToday,
          events: [credited.ev, ...s.events].slice(0, FEED_MAX),
        }));

        return credited.ev;
      },

      seedInitial: (n = FEED_SEED_COUNT) => {
        const state = get();
        if (state.txPool.length === 0) return;

        const current = get();
        const freshExisting = current.events.filter(isFreshEvent);
        if (freshExisting.length >= n) return;

        const seeded: LiquidationEvent[] = [];
        let txPoolCursor = current.txPoolCursor;
        let dailyFees = { ...current.dailyFees };
        let creditedEventIds = [...current.creditedEventIds];
        let txsToday = { ...current.txsToday };
        const needed = Math.max(0, n - freshExisting.length);

        for (let i = 0; i < needed; i += 1) {
          const created = createEvent(
            {
              txPool: current.txPool,
              txPoolCursor,
              events: [...seeded, ...freshExisting, ...current.events],
            },
            false,
          );
          if (!created.ev) break;
          txPoolCursor = created.txPoolCursor;

          const executedAt = seedExecutedAt(i, needed);
          const feeDay = utcDateKey(executedAt);
          const ev = {
            ...created.ev,
            executedAt,
            feeUsd: scaledFee(created.ev.amountUsdt, feeDay),
          };
          const credited = creditEventFee(
            dailyFees,
            creditedEventIds,
            txsToday,
            ev,
            feeDay,
          );
          dailyFees = credited.dailyFees;
          creditedEventIds = credited.creditedEventIds;
          txsToday = credited.txsToday;
          seeded.push(credited.ev);
        }

        if (seeded.length === 0) return;

        set({
          events: [...seeded, ...freshExisting].slice(0, FEED_MAX),
          txPoolCursor,
          dailyFees,
          creditedEventIds,
          txsToday,
        });
      },

      refreshTxPool: async () => {
        const state = get();
        if (
          state.txPoolUpdatedAt > 0 &&
          Date.now() - state.txPoolUpdatedAt < TX_POOL_REFRESH_MS
        ) {
          return;
        }

        try {
          const res = await fetch("/api/liquidation-engine/recent-txs", {
            cache: "no-store",
          });
          if (!res.ok) return;
          const data = (await res.json()) as {
            BSC: LiquidationChainTx[];
            POLYGON: LiquidationChainTx[];
            fetchedAt: number;
          };
          const txPool = [...(data.BSC ?? []), ...(data.POLYGON ?? [])]
            .filter(isFreshChainTx)
            .sort((a, b) => b.executedAt - a.executedAt);
          if (txPool.length === 0) return;

          set({
            txPool,
            txPoolUpdatedAt: data.fetchedAt ?? Date.now(),
          });
        } catch {
          /* keep existing pool */
        }
      },

      refreshStaleFeed: () => {
        const state = get();
        const recent = state.events.filter(isFreshEvent);
        if (recent.length >= FEED_SEED_COUNT) {
          if (recent.length !== state.events.length) {
            set({ events: recent });
          }
          return;
        }
        get().seedInitial(FEED_SEED_COUNT);
      },

      reset: () => set(initial),
    }),
    {
      name: "valtrix.liquidation.v1",
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
        events: s.events,
        cadence: s.cadence,
        running: s.running,
        dailyFees: s.dailyFees,
        creditedEventIds: s.creditedEventIds,
        txsToday: s.txsToday,
        txPool: s.txPool,
        txPoolUpdatedAt: s.txPoolUpdatedAt,
        txPoolCursor: s.txPoolCursor,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.running = true;
        if (!state.dailyFees) state.dailyFees = {};
        if (!state.txsToday) state.txsToday = {};
        if (!state.creditedEventIds) state.creditedEventIds = [];
        if (!state.txPool) state.txPool = [];
        if (!state.txPoolCursor) state.txPoolCursor = 0;
      },
    },
  ),
);

export function useLiquidationStoreHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const unsub = useLiquidationStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useLiquidationStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

function sumDailyFees(
  dailyFees: Record<string, number>,
  fromDay: string,
  toDay: string,
): number {
  let total = 0;
  for (const [day, amount] of Object.entries(dailyFees)) {
    if (day >= fromDay && day <= toDay) total += amount;
  }
  return total;
}

export function useLiquidationProfits() {
  const dailyFees = useLiquidationStore((s) => s.dailyFees);
  const txsToday = useLiquidationStore((s) => s.txsToday);

  return React.useMemo(() => {
    const todayKey = utcDateKey();
    const weekStartKey = utcDateKey(Date.now() - 6 * 86_400_000);

    const today = dailyFees[todayKey] ?? 0;
    const week = sumDailyFees(dailyFees, weekStartKey, todayKey);
    const allTime = Object.values(dailyFees).reduce((acc, n) => acc + n, 0);
    const processedToday = txsToday[todayKey] ?? 0;

    return { today, week, allTime, processedToday };
  }, [dailyFees, txsToday]);
}

export function useLiquidationFeedEngine(): void {
  const hydrated = useLiquidationStoreHydrated();
  const running = useLiquidationStore((s) => s.running);
  const cadence = useLiquidationStore((s) => s.cadence);
  const seedInitial = useLiquidationStore((s) => s.seedInitial);
  const push = useLiquidationStore((s) => s.pushEvent);
  const refreshTxPool = useLiquidationStore((s) => s.refreshTxPool);
  const refreshStaleFeed = useLiquidationStore((s) => s.refreshStaleFeed);

  React.useEffect(() => {
    if (!hydrated) return;
    void refreshTxPool().then(() => {
      refreshStaleFeed();
      seedInitial(FEED_SEED_COUNT);
    });
  }, [hydrated, refreshTxPool, refreshStaleFeed, seedInitial]);

  React.useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(() => {
      void refreshTxPool();
    }, TX_POOL_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [hydrated, refreshTxPool]);

  React.useEffect(() => {
    if (!hydrated || !running) return;
    const ms = CADENCE_MS[cadence];
    const id = window.setInterval(() => push(), ms);
    return () => window.clearInterval(id);
  }, [hydrated, running, cadence, push]);
}

export { CADENCE_MS };
