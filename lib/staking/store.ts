"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { getPlatformSettings } from "@/lib/platform/settings-store";
import { utcDayKey, type Position } from "@/lib/trade/constants";
import {
  PASSIVE_YIELD_DELAY_MS,
  PAYOUT_CAP_MULTIPLIER,
  REQUIRED_CONFIRMATIONS,
  STAKE_MAX_USDT,
  STAKE_MIN_USDT,
} from "@/lib/staking/constants";

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

export {
  PASSIVE_YIELD_DELAY_MS,
  PAYOUT_CAP_MULTIPLIER,
  REQUIRED_CONFIRMATIONS,
  STAKE_MAX_USDT,
  STAKE_MIN_USDT,
} from "@/lib/staking/constants";

interface StakingState {
  stakes: Stake[];
  dailyYields: DailyYield[];
  instantCredits: InstantCredit[];
  creditedPositionIds: string[];
  earningsBalance: number;
  totalEarned: number;
  pendingDeposit: PendingDeposit | null;
  lastAccrualDay: string | null;

  beginDeposit: (input: {
    amount: number;
    network: StakingNetwork;
    txHash?: string;
  }) => PendingDeposit;
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

      beginDeposit: ({ amount, network, txHash }) => {
        const normalizedHash = txHash?.trim();
        const pending: PendingDeposit = {
          id: makeId("dep"),
          amount,
          network,
          txHash:
            normalizedHash && /^0x[a-fA-F0-9]{64}$/.test(normalizedHash)
              ? normalizedHash
              : makeTxHash(),
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
          const rawCredit = (capital * rate.totalRateBps) / 10_000;
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

function endOfUtcDayMs(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 23, 59, 59, 999);
}

export function stakeEligibleForPassiveYield(
  stake: Stake,
  dayKey: string,
): boolean {
  if (stake.status !== "ACTIVE") return false;
  const confirmed = stake.confirmedAt ?? stake.createdAt;
  return confirmed + PASSIVE_YIELD_DELAY_MS <= endOfUtcDayMs(dayKey);
}

export function stakeEligibleForPassiveYieldNow(stake: Stake): boolean {
  if (stake.status !== "ACTIVE") return false;
  const confirmed = stake.confirmedAt ?? stake.createdAt;
  return confirmed + PASSIVE_YIELD_DELAY_MS <= Date.now();
}

function enumerateAccrualDays(stakes: Stake[], today: string): string[] {
  if (stakes.length === 0) return [];
  const firstEligibleMs = Math.min(
    ...stakes.map(
      (s) => (s.confirmedAt ?? s.createdAt) + PASSIVE_YIELD_DELAY_MS,
    ),
  );
  const out: string[] = [];
  const cursor = new Date(firstEligibleMs);
  cursor.setUTCHours(0, 0, 0, 0);
  while (utcDayKey(cursor.getTime()) < today) {
    out.push(utcDayKey(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function capitalActiveOn(stakes: Stake[], dayKey: string): number {
  let total = 0;
  for (const s of stakes) {
    if (stakeEligibleForPassiveYield(s, dayKey)) total += s.amount;
  }
  return total;
}

export function computeDailyRate(wins: number): {
  baseRateBps: number;
  bonusRateBps: number;
  totalRateBps: number;
} {
  const { baseYieldBps, bonusPerWinBps, maxDailyYieldBps } = getPlatformSettings();
  const safeWins = Math.max(0, Math.min(wins, 7));
  const bonusRateBps = safeWins * bonusPerWinBps;
  const totalRateBps = Math.min(baseYieldBps + bonusRateBps, maxDailyYieldBps);
  return {
    baseRateBps: baseYieldBps,
    bonusRateBps,
    totalRateBps,
  };
}

// --- Selectors / derived hooks (see portfolio-summary.ts) ---

export {
  deriveSummary,
  reconcileCapEarnings,
  usePortfolioSummary,
  useTodayYieldPreview,
  type CapEarningsBreakdown,
  type PortfolioSummary,
  type TodayYieldPreview,
} from "@/lib/staking/portfolio-summary";

export {
  useStakingStoreHydrated,
  useYieldEngine,
} from "@/lib/staking/yield-engine";

