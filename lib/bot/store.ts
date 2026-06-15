"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PAIRS } from "@/lib/market/pairs";
import { isLegacyReferenceTx } from "@/lib/bot/reference-txs";
import {
  BOT_CADENCE_MS,
  botProfitUsd,
  buildGlobalBotFeed,
  computeGlobalBotProfits,
} from "@/lib/bot/global-simulation";

export { botProfitUsd } from "@/lib/bot/global-simulation";

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
  entryPrice: number;
  exitPrice: number;
  /** UTC day key when profit was credited — survives tx rebinding. */
  profitDay?: string;
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

/** Simulated notionals — modest for an early-stage trading desk. */
const BOT_VOLUME_MIN = 200;
const BOT_VOLUME_MAX = 2_800;
const BOT_VOLUME_STEP = 25;
const BOT_PNL_BIAS = 0.44;
const BOT_PNL_SPREAD_BPS = 95;

interface BotState {
  operations: BotOperation[];
  cadence: BotCadence;
  running: boolean;
  dailyProfits: Record<string, number>;
  recentTxPool: Record<BotNetwork, RecentChainTx[]>;
  recentTxPoolUpdatedAt: number;
  txPoolCursor: Record<BotNetwork, number>;
  creditedOpIds: string[];
  /** Last exit price per pair — keeps the feed continuous across UTC days. */
  pairLastPrice: Record<string, number>;
  /** Latest live market anchors from Binance tickers. */
  marketAnchors: Record<string, number>;

  setCadence: (c: BotCadence) => void;
  setRunning: (v: boolean) => void;
  syncMarketAnchors: (prices: Record<string, number>) => void;
  pushOperation: () => BotOperation | null;
  seedInitial: (n?: number) => void;
  refreshRecentTxPool: () => Promise<void>;
  rebindOperationsToRecentTxs: () => void;
  refreshStaleFeed: () => void;
  syncGlobalFeed: () => void;
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
  creditedOpIds: [] as string[],
  pairLastPrice: {} as Record<string, number>,
  marketAnchors: {} as Record<string, number>,
};

const FALLBACK_PAIR_PRICES: Record<string, number> = {
  BTCUSDT: 75_757,
  ETHUSDT: 3_450,
  BNBUSDT: 620,
  SOLUSDT: 185,
  XRPUSDT: 0.62,
  DOGEUSDT: 0.18,
  ADAUSDT: 0.75,
  AVAXUSDT: 38,
};

function priceDecimals(pair: string): number {
  if (pair.startsWith("BTC") || pair.startsWith("ETH")) return 2;
  if (pair.includes("DOGE") || pair.includes("XRP") || pair.includes("ADA")) return 4;
  return 2;
}

function roundPairPrice(pair: string, price: number): number {
  const decimals = priceDecimals(pair);
  const factor = 10 ** decimals;
  return Math.round(price * factor) / factor;
}

function deriveOperationPrices(
  pair: string,
  direction: BotDirection,
  pnlBps: number,
  pairLastPrice: Record<string, number>,
  marketAnchors: Record<string, number>,
): { entryPrice: number; exitPrice: number } {
  const fallback = FALLBACK_PAIR_PRICES[pair] ?? 1_000;
  const entry = pairLastPrice[pair] ?? marketAnchors[pair] ?? fallback;
  const move = pnlBps / 10_000;
  const rawExit = direction === "UP" ? entry * (1 + move) : entry * (1 - move);
  return {
    entryPrice: roundPairPrice(pair, entry),
    exitPrice: roundPairPrice(pair, rawExit),
  };
}

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

function creditOperationProfit(
  dailyProfits: Record<string, number>,
  creditedOpIds: string[],
  op: BotOperation,
  profitDay: string,
): {
  dailyProfits: Record<string, number>;
  creditedOpIds: string[];
  op: BotOperation;
} | null {
  if (creditedOpIds.includes(op.id)) return null;
  const profit = botProfitUsd(op);
  if (profit <= 0) {
    return {
      dailyProfits,
      creditedOpIds: [...creditedOpIds, op.id],
      op: { ...op, profitDay },
    };
  }
  return {
    dailyProfits: {
      ...dailyProfits,
      [profitDay]: (dailyProfits[profitDay] ?? 0) + profit,
    },
    creditedOpIds: [...creditedOpIds, op.id],
    op: { ...op, profitDay },
  };
}

/** Spread seed timestamps across the last 7 UTC days for realistic profit buckets. */
function seedExecutedAt(index: number, total: number): number {
  const daysBack = total > 1 ? Math.floor((index / (total - 1)) * 6) : 0;
  const jitterMs = Math.floor(Math.random() * 3_600_000);
  return Date.now() - daysBack * 86_400_000 - jitterMs;
}

function rebuildProfitLedger(ops: BotOperation[]): {
  dailyProfits: Record<string, number>;
  creditedOpIds: string[];
  operations: BotOperation[];
} {
  const sorted = [...ops].sort((a, b) => b.executedAt - a.executedAt);
  let dailyProfits: Record<string, number> = {};
  let creditedOpIds: string[] = [];
  const operations = sorted.map((op, index) => {
    const profitDay =
      op.profitDay ??
      utcDateKey(seedExecutedAt(index, sorted.length));
    const credited = creditOperationProfit(
      dailyProfits,
      creditedOpIds,
      op,
      profitDay,
    );
    if (!credited) return op;
    dailyProfits = credited.dailyProfits;
    creditedOpIds = credited.creditedOpIds;
    return credited.op;
  });
  return { dailyProfits, creditedOpIds, operations };
}

function reconcileUncreditedOps(state: {
  operations: BotOperation[];
  dailyProfits: Record<string, number>;
  creditedOpIds: string[];
}): Pick<BotState, "operations" | "dailyProfits" | "creditedOpIds"> | null {
  let dailyProfits = { ...state.dailyProfits };
  let creditedOpIds = [...state.creditedOpIds];
  let operations = state.operations;
  let changed = false;

  const nextOps = operations.map((op) => {
    if (creditedOpIds.includes(op.id)) return op;
    const profitDay = op.profitDay ?? utcDateKey(op.executedAt);
    const credited = creditOperationProfit(
      dailyProfits,
      creditedOpIds,
      op,
      profitDay,
    );
    if (!credited) return op;
    dailyProfits = credited.dailyProfits;
    creditedOpIds = credited.creditedOpIds;
    changed = true;
    return credited.op;
  });

  if (!changed) return null;
  return { operations: nextOps, dailyProfits, creditedOpIds };
}

function sampleBotVolume(): number {
  const span = BOT_VOLUME_MAX - BOT_VOLUME_MIN;
  return (
    Math.round((BOT_VOLUME_MIN + Math.random() * span) / BOT_VOLUME_STEP) *
    BOT_VOLUME_STEP
  );
}

function sampleBotPnlBps(): number {
  return Math.round((Math.random() - BOT_PNL_BIAS) * BOT_PNL_SPREAD_BPS);
}

function rescaleLegacyOperation(
  op: BotOperation,
  pairLastPrice: Record<string, number>,
): BotOperation {
  const volume = Math.min(
    BOT_VOLUME_MAX,
    Math.max(
      BOT_VOLUME_MIN,
      Math.round((op.volume * 0.04) / BOT_VOLUME_STEP) * BOT_VOLUME_STEP,
    ),
  );
  const pnlBps = Math.max(-50, Math.min(60, Math.round(op.pnlBps * 0.11)));
  const { entryPrice, exitPrice } = deriveOperationPrices(
    op.pair,
    op.direction,
    pnlBps,
    pairLastPrice,
    {},
  );
  pairLastPrice[op.pair] = exitPrice;
  return { ...op, volume, pnlBps, entryPrice, exitPrice };
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
  state: Pick<
    BotState,
    | "recentTxPool"
    | "txPoolCursor"
    | "operations"
    | "pairLastPrice"
    | "marketAnchors"
  >,
  preferLive = false,
): {
  op: BotOperation | null;
  txPoolCursor: Record<BotNetwork, number>;
  pairLastPrice: Record<string, number>;
} {
  const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
  const direction: BotDirection = Math.random() > 0.48 ? "UP" : "DOWN";
  const volume = sampleBotVolume();
  const pnlBps = sampleBotPnlBps();
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
    return {
      op: null,
      txPoolCursor: state.txPoolCursor,
      pairLastPrice: state.pairLastPrice,
    };
  }

  const { entryPrice, exitPrice } = deriveOperationPrices(
    pair.binance,
    direction,
    pnlBps,
    state.pairLastPrice,
    state.marketAnchors,
  );

  const op: BotOperation = {
    id,
    pair: pair.binance,
    direction,
    volume,
    pnlBps,
    network,
    fakeTxHash: tx.hash,
    executedAt: preferLive ? Date.now() : tx.executedAt,
    entryPrice,
    exitPrice,
  };

  return {
    op,
    txPoolCursor: { ...state.txPoolCursor, [network]: nextCursor },
    pairLastPrice: {
      ...state.pairLastPrice,
      [pair.binance]: exitPrice,
    },
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
      profitDay: op.profitDay,
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

      syncMarketAnchors: (prices) =>
        set((s) => {
          const marketAnchors = { ...s.marketAnchors };
          let changed = false;
          for (const [symbol, price] of Object.entries(prices)) {
            if (!Number.isFinite(price) || price <= 0) continue;
            const rounded = roundPairPrice(symbol, price);
            if (marketAnchors[symbol] !== rounded) {
              marketAnchors[symbol] = rounded;
              changed = true;
            }
          }
          return changed ? { marketAnchors } : s;
        }),

      pushOperation: () => {
        const state = get();
        if (!hasUsableTxPool(state.recentTxPool)) return null;

        const { op, txPoolCursor, pairLastPrice } = createOperation(state, true);
        if (!op) return null;

        const profitDay = utcDateKey(op.executedAt);
        const credited = creditOperationProfit(
          state.dailyProfits,
          state.creditedOpIds,
          op,
          profitDay,
        );
        if (!credited) return op;

        set((s) => ({
          txPoolCursor,
          pairLastPrice,
          dailyProfits: credited.dailyProfits,
          creditedOpIds: credited.creditedOpIds,
          operations: [credited.op, ...s.operations].slice(0, FEED_MAX_OPS),
        }));
        return credited.op;
      },

      seedInitial: (n = FEED_SEED_COUNT) => {
        const state = get();
        if (!hasUsableTxPool(state.recentTxPool)) return;

        const current = get();
        const freshEnough =
          current.operations.length >= n &&
          current.operations.every(isFreshOperation);
        if (freshEnough) return;

        const freshExisting = current.operations.filter(isFreshOperation);
        const seededOps: BotOperation[] = [];
        let txPoolCursor = { ...current.txPoolCursor };
        let pairLastPrice = { ...current.pairLastPrice };
        let dailyProfits = { ...current.dailyProfits };
        let creditedOpIds = [...current.creditedOpIds];
        const needed = Math.max(0, n - freshExisting.length);
        for (let i = 0; i < needed; i += 1) {
          const created = createOperation(
            {
              ...current,
              pairLastPrice,
              operations: [
                ...seededOps,
                ...freshExisting,
                ...current.operations,
              ],
              txPoolCursor,
            },
            false,
          );
          if (!created.op) break;
          txPoolCursor = created.txPoolCursor;
          pairLastPrice = created.pairLastPrice;
          const executedAt = seedExecutedAt(i, needed);
          const profitDay = utcDateKey(executedAt);
          const credited = creditOperationProfit(
            dailyProfits,
            creditedOpIds,
            { ...created.op, executedAt },
            profitDay,
          );
          if (!credited) continue;
          dailyProfits = credited.dailyProfits;
          creditedOpIds = credited.creditedOpIds;
          seededOps.push(credited.op);
        }
        if (seededOps.length === 0 && freshExisting.length >= n) return;
        if (seededOps.length === 0) return;

        set({
          operations: [...seededOps, ...freshExisting].slice(0, FEED_MAX_OPS),
          txPoolCursor,
          pairLastPrice,
          dailyProfits,
          creditedOpIds,
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
        get().syncGlobalFeed();
      },

      syncGlobalFeed: () => {
        const state = get();
        const ms = BOT_CADENCE_MS[state.cadence];
        const operations = buildGlobalBotFeed(
          Date.now(),
          ms,
          FEED_MAX_OPS,
          state.recentTxPool,
          state.marketAnchors,
        );
        set({ operations });
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
        cadence: s.cadence,
        running: s.running,
        recentTxPool: s.recentTxPool,
        recentTxPoolUpdatedAt: s.recentTxPoolUpdatedAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.running = true;
        state.operations = [];
        state.dailyProfits = {};
        state.creditedOpIds = [];
        state.txPoolCursor = { BSC: 0, POLYGON: 0 };
        state.pairLastPrice = {};
        if (!state.marketAnchors) state.marketAnchors = {};
        if (!state.recentTxPool) {
          state.recentTxPool = { BSC: [], POLYGON: [] };
        }
        if (state.operations?.some((op) => isLegacyReferenceTx(op.fakeTxHash))) {
          state.recentTxPoolUpdatedAt = 0;
        }
      },
      migrate: (persisted, version) => {
        if (version < 8) {
          const prev = persisted as Partial<BotState>;
          return {
            ...initial,
            cadence: prev.cadence ?? initial.cadence,
            running: true,
            recentTxPool: prev.recentTxPool ?? { BSC: [], POLYGON: [] },
            recentTxPoolUpdatedAt: prev.recentTxPoolUpdatedAt ?? 0,
            marketAnchors: {},
          };
        }
        return persisted as BotState;
      },
      version: 8,
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

/** Company profit — identical for every user (UTC slot ledger). */
export function useCompanyProfits() {
  const cadence = useBotStore((s) => s.cadence);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return React.useMemo(
    () => computeGlobalBotProfits(now, BOT_CADENCE_MS[cadence]),
    [now, cadence],
  );
}

export function useBotFeedEngine(): void {
  const hydrated = useBotStoreHydrated();
  const running = useBotStore((s) => s.running);
  const cadence = useBotStore((s) => s.cadence);
  const syncGlobalFeed = useBotStore((s) => s.syncGlobalFeed);
  const refreshRecentTxPool = useBotStore((s) => s.refreshRecentTxPool);

  React.useEffect(() => {
    if (!hydrated) return;
    void refreshRecentTxPool().then(() => {
      syncGlobalFeed();
    });
  }, [hydrated, refreshRecentTxPool, syncGlobalFeed]);

  React.useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(() => {
      void refreshRecentTxPool();
    }, TX_POOL_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [hydrated, refreshRecentTxPool]);

  React.useEffect(() => {
    if (!hydrated || !running) return;
    syncGlobalFeed();
    const ms = BOT_CADENCE_MS[cadence];
    const id = window.setInterval(() => syncGlobalFeed(), ms);
    return () => window.clearInterval(id);
  }, [hydrated, running, cadence, syncGlobalFeed]);
}

export { BOT_CADENCE_MS as CADENCE_MS };
