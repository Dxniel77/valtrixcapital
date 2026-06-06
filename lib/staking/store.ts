"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  BASE_YIELD_BPS,
  BONUS_PER_WIN_BPS,
  MAX_DAILY_YIELD_BPS,
  utcDayKey,
  useTradeStore,
  useTradeStoreHydrated,
  type Position,
} from "@/lib/trade/store";

export type StakingNetwork = "BSC" | "POLYGON";
export type StakeStatus = "PENDING" | "ACTIVE" | "COMPLETED" | "FAILED";

export interface Stake {
  id: string;
  amount: number;
  network: StakingNetwork;
  status: StakeStatus;
  txHash: string;
  createdAt: number;
  confirmedAt?: number;
}

export interface DailyYield {
  id: string;
  date: string;
  capitalSnapshot: number;
  baseRateBps: number;
  bonusRateBps: number;
  totalRateBps: number;
  wins: number;
  losses: number;
  creditedAmount: number;
  createdAt: number;
}

export interface InstantCredit {
  id: string;
  positionId: string;
  amount: number;
  createdAt: number;
  type: "TRADE_WIN";
}

export interface PendingDeposit {
  id: string;
  amount: number;
  network: StakingNetwork;
  txHash: string;
  startedAt: number;
  confirmations: number;
  requiredConfirmations: number;
}

export const STAKE_MIN_USDT = 15;
export const STAKE_MAX_USDT = 100_000;
export const PAYOUT_CAP_MULTIPLIER = 2; // 200%
export const REQUIRED_CONFIRMATIONS = 12;

interface StakingState {
  stakes: Stake[];
  dailyYields: DailyYield[];
  instantCredits: InstantCredit[];
  creditedPositionIds: string[];
  earningsBalance: number;
  totalEarned: number;
  pendingDeposit: PendingDeposit | null;
  lastAccrualDay: string | null;

  beginDeposit: (input: { amount: number; network: StakingNetwork }) => PendingDeposit;
  advanceDepositConfirmation: () => void;
  finalizePendingDeposit: () => Stake | null;
  cancelPendingDeposit: () => void;

  catchupAccruals: (positions: Position[]) => void;
  creditTradeWin: (positionId: string, amount: number) => boolean;
  creditNetworkPayout: (amount: number) => number;
  reset: () => void;
}

const initial = {
  stakes: [] as Stake[],
  dailyYields: [] as DailyYield[],
  instantCredits: [] as InstantCredit[],
  creditedPositionIds: [] as string[],
  earningsBalance: 0,
  totalEarned: 0,
  pendingDeposit: null as PendingDeposit | null,
  lastAccrualDay: null as string | null,
};

function makeId(prefix: string): string {
  const rand =
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand.replace(/-/g, "").slice(0, 16)}`;
}

function makeTxHash(): string {
  let out = "0x";
  const hex = "0123456789abcdef";
  for (let i = 0; i < 64; i += 1) {
    out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

export const useStakingStore = create<StakingState>()(
  persist(
    (set, get) => ({
      ...initial,

      beginDeposit: ({ amount, network }) => {
        const pending: PendingDeposit = {
          id: makeId("dep"),
          amount,
          network,
          txHash: makeTxHash(),
          startedAt: Date.now(),
          confirmations: 0,
          requiredConfirmations: REQUIRED_CONFIRMATIONS,
        };
        set({ pendingDeposit: pending });
        return pending;
      },

      advanceDepositConfirmation: () => {
        const pending = get().pendingDeposit;
        if (!pending) return;
        if (pending.confirmations >= pending.requiredConfirmations) return;
        set({
          pendingDeposit: {
            ...pending,
            confirmations: Math.min(
              pending.confirmations + 1,
              pending.requiredConfirmations,
            ),
          },
        });
      },

      finalizePendingDeposit: () => {
        const pending = get().pendingDeposit;
        if (!pending) return null;
        if (pending.confirmations < pending.requiredConfirmations) return null;
        const now = Date.now();
        const stake: Stake = {
          id: makeId("stk"),
          amount: pending.amount,
          network: pending.network,
          status: "ACTIVE",
          txHash: pending.txHash,
          createdAt: pending.startedAt,
          confirmedAt: now,
        };
        set((s) => ({
          stakes: [stake, ...s.stakes],
          pendingDeposit: null,
        }));
        return stake;
      },

      cancelPendingDeposit: () => set({ pendingDeposit: null }),

      catchupAccruals: (positions) => {
        const today = utcDayKey();
        const state = get();
        if (state.stakes.length === 0) {
          if (state.lastAccrualDay !== today) set({ lastAccrualDay: today });
          return;
        }
        const existingDays = new Set(state.dailyYields.map((y) => y.date));
        const targets = enumerateAccrualDays(state.stakes, today).filter(
          (d) => !existingDays.has(d),
        );
        if (targets.length === 0) {
          if (state.lastAccrualDay !== today) set({ lastAccrualDay: today });
          return;
        }
        const newRecords: DailyYield[] = [];
        let earnings = state.earningsBalance;
        let totalEarned = state.totalEarned;
        for (const date of targets) {
          const capital = capitalActiveOn(state.stakes, date);
          if (capital <= 0) continue;
          const dayPositions = positions.filter(
            (p) => utcDayKey(p.openedAt) === date && p.status !== "OPEN",
          );
          const wins = dayPositions.filter((p) => p.status === "WIN").length;
          const losses = dayPositions.filter((p) => p.status === "LOSS").length;
          const rate = computeDailyRate(wins);
          const rawCredit = (capital * BASE_YIELD_BPS) / 10_000;
          const applied = applyEarningsCredit(
            { stakes: state.stakes, totalEarned },
            rawCredit,
          );
          if (applied <= 0) continue;
          const record: DailyYield = {
            id: makeId("yld"),
            date,
            capitalSnapshot: capital,
            baseRateBps: rate.baseRateBps,
            bonusRateBps: rate.bonusRateBps,
            totalRateBps: rate.totalRateBps,
            wins,
            losses,
            creditedAmount: applied,
            createdAt: Date.now(),
          };
          newRecords.push(record);
          earnings += applied;
          totalEarned += applied;
        }
        if (newRecords.length === 0) {
          if (state.lastAccrualDay !== today) set({ lastAccrualDay: today });
          return;
        }
        const merged = [...newRecords, ...state.dailyYields].sort((a, b) =>
          a.date < b.date ? 1 : -1,
        );

        set({
          dailyYields: merged,
          earningsBalance: earnings,
          totalEarned,
          stakes: stakesIfCapReached(state.stakes, totalEarned),
          lastAccrualDay: today,
        });
      },

      creditTradeWin: (positionId, amount) => {
        if (amount <= 0) return false;
        const state = get();
        if (state.creditedPositionIds.includes(positionId)) return false;

        const applied = applyEarningsCredit(state, amount);
        if (applied <= 0) return false;

        const credit: InstantCredit = {
          id: makeId("op"),
          positionId,
          amount: applied,
          createdAt: Date.now(),
          type: "TRADE_WIN",
        };

        set((s) => ({
          creditedPositionIds: [...s.creditedPositionIds, positionId],
          instantCredits: [credit, ...s.instantCredits].slice(0, 500),
          earningsBalance: s.earningsBalance + applied,
          totalEarned: s.totalEarned + applied,
          stakes: stakesIfCapReached(s.stakes, s.totalEarned + applied),
        }));
        return true;
      },

      creditNetworkPayout: (amount) => {
        if (amount <= 0) return 0;
        const state = get();
        const applied = applyEarningsCredit(state, amount);
        if (applied <= 0) return 0;
        set((s) => ({
          earningsBalance: s.earningsBalance + applied,
          totalEarned: s.totalEarned + applied,
          stakes: stakesIfCapReached(s.stakes, s.totalEarned + applied),
        }));
        return applied;
      },

      reset: () => set(initial),
    }),
    {
      name: "valtrix.staking.v1",
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
        stakes: s.stakes,
        dailyYields: s.dailyYields,
        instantCredits: s.instantCredits,
        creditedPositionIds: s.creditedPositionIds,
        earningsBalance: s.earningsBalance,
        totalEarned: s.totalEarned,
        pendingDeposit: s.pendingDeposit,
        lastAccrualDay: s.lastAccrualDay,
      }),
    },
  ),
);

// --- Helpers ---

export function activeCapital(stakes: Stake[]): number {
  return stakes
    .filter((s) => s.status === "ACTIVE")
    .reduce((acc, s) => acc + s.amount, 0);
}

function applyEarningsCredit(
  state: Pick<StakingState, "stakes" | "totalEarned">,
  amount: number,
): number {
  const totalCapital = activeCapital(state.stakes);
  const payoutCap = totalCapital * PAYOUT_CAP_MULTIPLIER;
  if (payoutCap <= 0) return 0;
  const room = Math.max(0, payoutCap - state.totalEarned);
  return Math.min(amount, room);
}

function stakesIfCapReached(stakes: Stake[], totalEarned: number): Stake[] {
  const totalCapital = activeCapital(stakes);
  const payoutCap = totalCapital * PAYOUT_CAP_MULTIPLIER;
  if (totalCapital > 0 && totalEarned >= payoutCap) {
    return stakes.map((s) =>
      s.status === "ACTIVE" ? { ...s, status: "COMPLETED" as const } : s,
    );
  }
  return stakes;
}

function sumStakes(stakes: Stake[]): number {
  return activeCapital(stakes);
}

function enumerateAccrualDays(stakes: Stake[], today: string): string[] {
  // Only accrue past UTC days where at least one stake was active.
  // The "today" UTC day is intentionally excluded — accrues at 00:00 UTC.
  const first = stakes.reduce<number | null>((acc, s) => {
    const ts = s.confirmedAt ?? s.createdAt;
    return acc === null || ts < acc ? ts : acc;
  }, null);
  if (first === null) return [];
  const out: string[] = [];
  const cursor = new Date(first);
  cursor.setUTCHours(0, 0, 0, 0);
  // Start from the day AFTER the day a stake was made — yield accrues for full UTC days only.
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (utcDayKey(cursor.getTime()) <= today) {
    const key = utcDayKey(cursor.getTime());
    if (key === today) break;
    out.push(key);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function capitalActiveOn(stakes: Stake[], dayKey: string): number {
  let total = 0;
  for (const s of stakes) {
    const startDay = utcDayKey(s.confirmedAt ?? s.createdAt);
    if (startDay < dayKey) total += s.amount;
  }
  return total;
}

export function computeDailyRate(wins: number): {
  baseRateBps: number;
  bonusRateBps: number;
  totalRateBps: number;
} {
  const safeWins = Math.max(0, Math.min(wins, 7));
  const bonusRateBps = safeWins * BONUS_PER_WIN_BPS;
  const totalRateBps = Math.min(
    BASE_YIELD_BPS + bonusRateBps,
    MAX_DAILY_YIELD_BPS,
  );
  return {
    baseRateBps: BASE_YIELD_BPS,
    bonusRateBps,
    totalRateBps,
  };
}

// --- Selectors / derived hooks ---

export interface PortfolioSummary {
  totalCapital: number;
  activeStakes: number;
  totalEarned: number;
  earningsBalance: number;
  payoutCap: number;
  capProgressPct: number;
  daysActive: number;
  remainingToCap: number;
  isCapReached: boolean;
  firstStakeAt: number | null;
}

export function deriveSummary(state: {
  stakes: Stake[];
  totalEarned: number;
  earningsBalance: number;
}): PortfolioSummary {
  const active = state.stakes.filter((s) => s.status === "ACTIVE");
  const totalCapital = active.reduce((acc, s) => acc + s.amount, 0);
  const payoutCap = totalCapital * PAYOUT_CAP_MULTIPLIER;
  const capProgressPct =
    payoutCap > 0 ? Math.min(100, (state.totalEarned / payoutCap) * 100) : 0;
  const firstStakeAt = active.reduce<number | null>((acc, s) => {
    const ts = s.confirmedAt ?? s.createdAt;
    return acc === null || ts < acc ? ts : acc;
  }, null);
  const daysActive = firstStakeAt
    ? Math.max(0, Math.floor((Date.now() - firstStakeAt) / 86_400_000))
    : 0;
  return {
    totalCapital,
    activeStakes: active.length,
    totalEarned: state.totalEarned,
    earningsBalance: state.earningsBalance,
    payoutCap,
    capProgressPct,
    daysActive,
    remainingToCap: Math.max(0, payoutCap - state.totalEarned),
    isCapReached: payoutCap > 0 && state.totalEarned >= payoutCap,
    firstStakeAt,
  };
}

export function usePortfolioSummary(): PortfolioSummary {
  const stakes = useStakingStore((s) => s.stakes);
  const totalEarned = useStakingStore((s) => s.totalEarned);
  const earningsBalance = useStakingStore((s) => s.earningsBalance);
  return React.useMemo(
    () => deriveSummary({ stakes, totalEarned, earningsBalance }),
    [stakes, totalEarned, earningsBalance],
  );
}

export function useStakingStoreHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const unsub = useStakingStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useStakingStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

/**
 * Wires the yield engine to the trade store. Runs on mount, every minute,
 * and whenever positions change (so a freshly resolved trade today still
 * applies retroactively if the user later refreshes after UTC midnight).
 */
export function useYieldEngine(): void {
  const tradeHydrated = useTradeStoreHydrated();
  const stakingHydrated = useStakingStoreHydrated();
  const catchup = useStakingStore((s) => s.catchupAccruals);
  const positions = useTradeStore((s) => s.positions);

  React.useEffect(() => {
    if (!tradeHydrated || !stakingHydrated) return;
    catchup(positions);
    const id = setInterval(
      () => catchup(useTradeStore.getState().positions),
      60_000,
    );
    return () => clearInterval(id);
  }, [tradeHydrated, stakingHydrated, catchup, positions]);
}

/**
 * Preview: "today" UTC day is in progress. Compute the rate the user is
 * currently earning based on their wins so far + their active capital.
 */
export interface TodayYieldPreview {
  date: string;
  capital: number;
  baseRateBps: number;
  bonusRateBps: number;
  totalRateBps: number;
  projectedAmount: number;
  wins: number;
  losses: number;
}

export function useTodayYieldPreview(): TodayYieldPreview {
  const stakes = useStakingStore((s) => s.stakes);
  const positions = useTradeStore((s) => s.positions);
  return React.useMemo(() => {
    const today = utcDayKey();
    const capital = stakes
      .filter(
        (s) =>
          s.status === "ACTIVE" &&
          utcDayKey(s.confirmedAt ?? s.createdAt) < today,
      )
      .reduce((acc, s) => acc + s.amount, 0);
    const todays = positions.filter(
      (p) => utcDayKey(p.openedAt) === today && p.status !== "OPEN",
    );
    const wins = todays.filter((p) => p.status === "WIN").length;
    const losses = todays.filter((p) => p.status === "LOSS").length;
    const rate = computeDailyRate(wins);
    const projectedAmount = (capital * rate.totalRateBps) / 10_000;
    return {
      date: today,
      capital,
      baseRateBps: rate.baseRateBps,
      bonusRateBps: rate.bonusRateBps,
      totalRateBps: rate.totalRateBps,
      projectedAmount,
      wins,
      losses,
    };
  }, [stakes, positions]);
}
