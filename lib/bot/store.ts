"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PAIRS } from "@/lib/market/pairs";
import { isLegacyReferenceTx } from "@/lib/bot/reference-txs";

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

export interface RecentChainTx {
  hash: string;
  executedAt: number;
}

export type BotCadence = "fast" | "normal" | "slow";

const CADENCE_MS: Record<BotCadence, number> = {
  fast: 6_000,
  normal: 12_000,
  slow: 24_000,
};

const FEED_MAX_OPS = 80;
const FEED_SEED_COUNT = 14;
const FEED_STALE_MS = 6 * 60 * 60 * 1000;
const TX_POOL_REFRESH_MS = 2 * 60 * 1000;
const TX_MAX_AGE_MS = 6 * 60 * 60 * 1000;

interface BotState {
  operations: BotOperation[];
  cadence: BotCadence;
  running: boolean;
  dailyProfits: Record<string, number>;
  recentTxPool: Record<BotNetwork, RecentChainTx[]>;
  recentTxPoolUpdatedAt: number;
  txPoolCursor: Record<BotNetwork, number>;
  profitsMigrated: boolean;

  setCadence: (c: BotCadence) => void;
  setRunning: (v: boolean) => void;
  pushOperation: () => BotOperation | null;
  seedInitial: (n?: number) => void;
  refreshRecentTxPool: () => Promise<void>;
  rebindOperationsToRecentTxs: () => void;
  refreshStaleFeed: () => void;
  reset: () => void;
}

const initial = {
  operations: [] as BotOperation[],
  cadence: "normal" as BotCadence,
  running: true,
  dailyProfits: {} as Record<string, number>,
  recentTxPool: { BSC: [], POLYGON: [] } as Record<BotNetwork, RecentChainTx[]>,
  recentTxPoolUpdatedAt: 0,
  txPoolCursor: { BSC: 0, POLYGON: 0 },
  profitsMigrated: false,
};

function makeId(): string {
  return `bot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function utcDateKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function hasUsableTxPool(pool: Record<BotNetwork, RecentChainTx[]>): boolean {
  return pool.BSC.length > 0 || pool.POLYGON.length > 0;
}

function isFreshChainTx(tx: RecentChainTx): boolean {
  return Date.now() - tx.executedAt <= TX_MAX_AGE_MS;
}

function isFreshOperation(op: BotOperation): boolean {
  const age = Date.now() - op.executedAt;
  return age <= FEED_STALE_MS && !isLegacyReferenceTx(op.fakeTxHash);
}

function buildDailyProfitsFromOps(ops: BotOperation[]): Record<string, number> {
  const daily: Record<string, number> = {};
  for (const op of ops) {
    const day = utcDateKey(op.executedAt);
    daily[day] = (daily[day] ?? 0) + botProfitUsd(op);
  }
  return daily;
}

function mergeDailyProfits(
  existing: Record<string, number>,
  fromOps: Record<string, number>,
): Record<string, number> {
  const merged = { ...existing };
  for (const [day, amount] of Object.entries(fromOps)) {
    merged[day] = Math.max(merged[day] ?? 0, amount);
  }
  return merged;
}

function pickChainTx(
  network: BotNetwork,
  pool: RecentChainTx[],
  cursor: number,
  usedHashes: Set<string>,
): { tx: RecentChainTx | null; nextCursor: number } {
  const freshPool = pool.filter(isFreshChainTx);
  if (freshPool.length === 0) return { tx: null, nextCursor: cursor };

  const start = cursor % freshPool.length;
  for (let i = 0; i < freshPool.length; i += 1) {
    const idx = (start + i) % freshPool.length;
    const candidate = freshPool[idx]!;
    if (usedHashes.has(candidate.hash)) continue;
    return { tx: candidate, nextCursor: idx + 1 };
  }

  const fallback = freshPool[start % freshPool.length]!;
  return { tx: fallback, nextCursor: start + 1 };
}

function createOperation(
  state: Pick<BotState, "recentTxPool" | "txPoolCursor" | "operations">,
  preferLive = false,
): { op: BotOperation | null; txPoolCursor: Record<BotNetwork, number> } {
  const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
  const direction: BotDirection = Math.random() > 0.48 ? "UP" : "DOWN";
  const volume = Math.round((5_000 + Math.random() * 95_000) / 100) * 100;
  const pnlBps = Math.round((Math.random() - 0.35) * 800);
  const network: BotNetwork = Math.random() > 0.55 ? "BSC" : "POLYGON";
  const id = makeId();
  const usedHashes = new Set(state.operations.map((op) => op.fakeTxHash));
  const { tx, nextCursor } = pickChainTx(
    network,
    state.recentTxPool[network],
    state.txPoolCursor[network],
    usedHashes,
  );

  if (!tx) {
    return { op: null, txPoolCursor: state.txPoolCursor };
  }

  const op: BotOperation = {
    id,
    pair: pair.binance,
    direction,
    volume,
    pnlBps,
    network,
    fakeTxHash: tx.hash,
    executedAt: preferLive ? Date.now() : tx.executedAt,
  };

  return {
    op,
    txPoolCursor: { ...state.txPoolCursor, [network]: nextCursor },
  };
}

function rebindOp(
  op: BotOperation,
  pool: RecentChainTx[],
  cursor: number,
  usedHashes: Set<string>,
): { op: BotOperation; nextCursor: number } {
  const { tx, nextCursor } = pickChainTx(op.network, pool, cursor, usedHashes);
  if (!tx) return { op, nextCursor: cursor };
  usedHashes.add(tx.hash);
  return {
    op: {
      ...op,
      fakeTxHash: tx.hash,
      executedAt: tx.executedAt,
    },
    nextCursor,
  };
}

export const useBotStore = create<BotState>()(
  persist(
    (set, get) => ({
      ...initial,

      setCadence: (cadence) => set({ cadence }),
      setRunning: (running) => set({ running }),

      pushOperation: () => {
        const state = get();
        if (!hasUsableTxPool(state.recentTxPool)) return null;

        const { op, txPoolCursor } = createOperation(state, true);
        if (!op) return null;

        const day = utcDateKey(op.executedAt);
        const profit = botProfitUsd(op);

        set((s) => ({
          txPoolCursor,
          operations: [op, ...s.operations].slice(0, FEED_MAX_OPS),
          dailyProfits: {
            ...s.dailyProfits,
            [day]: (s.dailyProfits[day] ?? 0) + profit,
          },
        }));
        return op;
      },

      seedInitial: (n = FEED_SEED_COUNT) => {
        const state = get();
        if (!hasUsableTxPool(state.recentTxPool)) return;

        const prev = state.operations;
        const now = Date.now();

        if (!state.profitsMigrated) {
          const fromOps = buildDailyProfitsFromOps(prev);
          set({
            dailyProfits: mergeDailyProfits(state.dailyProfits, fromOps),
            profitsMigrated: true,
          });
        }

        const current = get();
        const freshEnough =
          current.operations.length >= n &&
          current.operations.every(isFreshOperation);
        if (freshEnough) return;

        const ops: BotOperation[] = [];
        let txPoolCursor = { ...current.txPoolCursor };
        for (let i = 0; i < n; i += 1) {
          const created = createOperation({
            ...current,
            operations: [...ops, ...current.operations],
            txPoolCursor,
          });
          if (!created.op) break;
          txPoolCursor = created.txPoolCursor;
          ops.push(created.op);
        }
        if (ops.length === 0) return;

        const shouldAccrueSeed = Object.keys(current.dailyProfits).length === 0;
        const dailyProfits = { ...current.dailyProfits };
        if (shouldAccrueSeed) {
          for (const op of ops) {
            const day = utcDateKey(op.executedAt);
            dailyProfits[day] = (dailyProfits[day] ?? 0) + botProfitUsd(op);
          }
        }

        set({
          operations: ops,
          txPoolCursor,
          dailyProfits,
          profitsMigrated: true,
        });
      },

      refreshRecentTxPool: async () => {
        const state = get();
        if (
          state.recentTxPoolUpdatedAt > 0 &&
          Date.now() - state.recentTxPoolUpdatedAt < TX_POOL_REFRESH_MS
        ) {
          return;
        }

        try {
          const res = await fetch("/api/bot/recent-txs", { cache: "no-store" });
          if (!res.ok) return;
          const data = (await res.json()) as {
            BSC: RecentChainTx[];
            POLYGON: RecentChainTx[];
            fetchedAt: number;
          };
          const recentTxPool = {
            BSC: (data.BSC ?? []).filter(isFreshChainTx),
            POLYGON: (data.POLYGON ?? []).filter(isFreshChainTx),
          };
          if (!hasUsableTxPool(recentTxPool)) return;

          set({
            recentTxPool,
            recentTxPoolUpdatedAt: data.fetchedAt ?? Date.now(),
          });
          get().rebindOperationsToRecentTxs();
        } catch {
          // Keep the existing pool when the explorer API is unavailable.
        }
      },

      rebindOperationsToRecentTxs: () => {
        const state = get();
        if (!state.operations.length || !hasUsableTxPool(state.recentTxPool)) {
          return;
        }

        const usedHashes = new Set<string>();
        const cursors = { ...state.txPoolCursor };
        const operations = state.operations.map((op) => {
          if (isFreshOperation(op) && !isLegacyReferenceTx(op.fakeTxHash)) {
            usedHashes.add(op.fakeTxHash);
            return op;
          }
          const pool = state.recentTxPool[op.network];
          const { op: rebound, nextCursor } = rebindOp(
            op,
            pool,
            cursors[op.network],
            usedHashes,
          );
          cursors[op.network] = nextCursor;
          return rebound;
        });

        set({ operations, txPoolCursor: cursors });
      },

      refreshStaleFeed: () => {
        const state = get();
        const recentOps = state.operations.filter(isFreshOperation);

        if (recentOps.length >= FEED_SEED_COUNT) {
          if (recentOps.length !== state.operations.length) {
            set({ operations: recentOps });
          }
          return;
        }

        get().seedInitial(FEED_SEED_COUNT);
      },

      reset: () => set(initial),
    }),
    {
      name: "valtrix.bot.v4",
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
        dailyProfits: s.dailyProfits,
        recentTxPool: s.recentTxPool,
        recentTxPoolUpdatedAt: s.recentTxPoolUpdatedAt,
        txPoolCursor: s.txPoolCursor,
        profitsMigrated: s.profitsMigrated,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.dailyProfits) state.dailyProfits = {};
        if (!state.recentTxPool) {
          state.recentTxPool = { BSC: [], POLYGON: [] };
        }
        if (!state.txPoolCursor) {
          state.txPoolCursor = { BSC: 0, POLYGON: 0 };
        }
        if (state.operations?.some((op) => isLegacyReferenceTx(op.fakeTxHash))) {
          state.recentTxPoolUpdatedAt = 0;
        }
      },
      migrate: (persisted, version) => {
        const prev = persisted as Partial<BotState>;
        const ops = (prev.operations ?? []).filter(
          (op) => !isLegacyReferenceTx(op.fakeTxHash),
        );

        if (version < 4) {
          return {
            ...initial,
            ...prev,
            operations: ops,
            dailyProfits:
              prev.dailyProfits && Object.keys(prev.dailyProfits).length > 0
                ? prev.dailyProfits
                : buildDailyProfitsFromOps(prev.operations ?? []),
            profitsMigrated: true,
            recentTxPool: { BSC: [], POLYGON: [] },
            recentTxPoolUpdatedAt: 0,
            txPoolCursor: { BSC: 0, POLYGON: 0 },
          };
        }
        return persisted as BotState;
      },
      version: 4,
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

function sumDailyProfits(
  dailyProfits: Record<string, number>,
  fromDayInclusive: string,
  toDayInclusive: string,
): number {
  let total = 0;
  for (const [day, amount] of Object.entries(dailyProfits)) {
    if (day >= fromDayInclusive && day <= toDayInclusive) {
      total += amount;
    }
  }
  return total;
}

export function useCompanyProfits() {
  const dailyProfits = useBotStore((s) => s.dailyProfits);

  return React.useMemo(() => {
    const todayKey = utcDateKey();
    const weekStartKey = utcDateKey(Date.now() - 6 * 86_400_000);

    const today = dailyProfits[todayKey] ?? 0;
    const week = sumDailyProfits(dailyProfits, weekStartKey, todayKey);
    const allTime = Object.values(dailyProfits).reduce((acc, n) => acc + n, 0);

    return { today, week, allTime };
  }, [dailyProfits]);
}

export function useBotFeedEngine(): void {
  const hydrated = useBotStoreHydrated();
  const running = useBotStore((s) => s.running);
  const cadence = useBotStore((s) => s.cadence);
  const seedInitial = useBotStore((s) => s.seedInitial);
  const push = useBotStore((s) => s.pushOperation);
  const refreshRecentTxPool = useBotStore((s) => s.refreshRecentTxPool);
  const refreshStaleFeed = useBotStore((s) => s.refreshStaleFeed);
  const rebind = useBotStore((s) => s.rebindOperationsToRecentTxs);

  React.useEffect(() => {
    if (!hydrated) return;
    void refreshRecentTxPool().then(() => {
      rebind();
      refreshStaleFeed();
      seedInitial(FEED_SEED_COUNT);
    });
  }, [hydrated, refreshRecentTxPool, rebind, refreshStaleFeed, seedInitial]);

  React.useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(() => {
      void refreshRecentTxPool();
    }, TX_POOL_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [hydrated, refreshRecentTxPool]);

  React.useEffect(() => {
    if (!hydrated) return;
    let lastDay = utcDateKey();
    const id = window.setInterval(() => {
      const today = utcDateKey();
      if (today === lastDay) return;
      lastDay = today;
      refreshStaleFeed();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [hydrated, refreshStaleFeed]);

  React.useEffect(() => {
    if (!hydrated || !running) return;
    const ms = CADENCE_MS[cadence];
    const id = window.setInterval(() => push(), ms);
    return () => window.clearInterval(id);
  }, [hydrated, running, cadence, push]);
}

export { CADENCE_MS };
