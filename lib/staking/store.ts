"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { getPlatformSettings } from "@/lib/platform/settings-store";
import { persistServerOwnedDataOnly } from "@/lib/persist/production-guard";
import { utcDayKey, type Position } from "@/lib/trade/constants";
import {
  getPassiveYieldDelayMs,
  getYieldAccrualIntervalMs,
  PAYOUT_CAP_MULTIPLIER,
  REQUIRED_CONFIRMATIONS,
  STAKE_MAX_USDT,
  STAKE_MIN_USDT,
} from "@/lib/staking/constants";
import {
  countPassivePeriodsDue,
  MAX_PASSIVE_CATCHUP_PERIODS,
  passiveCreditUsdtForPeriod,
} from "@/lib/yield/passive-accrual";
import { hasRealDepositedCapital } from "@/lib/staking/capital-profile";

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
  /** Server-side deposit id when backend is active. */
  serverDepositId?: string;
  amount: number;
  network: StakingNetwork;
  txHash: string;
  startedAt: number;
  confirmations: number;
  requiredConfirmations: number;
}

export {
  getPassiveYieldDelayMs,
  PAYOUT_CAP_MULTIPLIER,
  REQUIRED_CONFIRMATIONS,
  STAKE_MIN_USDT,
  STAKE_MAX_USDT,
} from "@/lib/staking/constants";

export type BalanceAdjustmentTarget = "WITHDRAWABLE" | "STAKING" | "COPY";

export interface BalanceAdjustment {
  id: string;
  amount: number;
  note: string;
  createdAt: number;
  target: BalanceAdjustmentTarget;
}

interface StakingState {
  stakes: Stake[];
  dailyYields: DailyYield[];
  instantCredits: InstantCredit[];
  balanceAdjustments: BalanceAdjustment[];
  creditedPositionIds: string[];
  earningsBalance: number;
  totalEarned: number;
  realCapital: number;
  companyCapital: number;
  accountGranted: boolean;
  capitalProfileSynced: boolean;
  pendingDeposit: PendingDeposit | null;
  lastAccrualDay: string | null;

  beginDeposit: (input: {
    amount: number;
    network: StakingNetwork;
    txHash?: string;
    serverDepositId?: string;
  }) => PendingDeposit;
  advanceDepositConfirmation: () => void;
  setPendingConfirmations: (confirmations: number) => void;
  finalizePendingDeposit: () => Stake | null;
  cancelPendingDeposit: () => void;

  catchupAccruals: (positions: Position[]) => void;
  creditTradeWin: (positionId: string, amount: number) => boolean;
  creditNetworkPayout: (amount: number) => number;
  applyBalanceAdjustment: (input: {
    id: string;
    amount: number;
    note: string;
    target?: BalanceAdjustmentTarget;
  }) => void;
  reset: () => void;
}

const initial = {
  stakes: [] as Stake[],
  dailyYields: [] as DailyYield[],
  instantCredits: [] as InstantCredit[],
  balanceAdjustments: [] as BalanceAdjustment[],
  creditedPositionIds: [] as string[],
  earningsBalance: 0,
  totalEarned: 0,
  realCapital: 0,
  companyCapital: 0,
  accountGranted: false,
  capitalProfileSynced: false,
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

      beginDeposit: ({ amount, network, txHash, serverDepositId }) => {
        const normalizedHash = txHash?.trim();
        const pending: PendingDeposit = {
          id: serverDepositId ?? makeId("dep"),
          serverDepositId,
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

      setPendingConfirmations: (confirmations) => {
        const pending = get().pendingDeposit;
        if (!pending) return;
        set({
          pendingDeposit: {
            ...pending,
            confirmations: Math.min(
              Math.max(0, confirmations),
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

      catchupAccruals: (_positions) => {
        const now = Date.now();
        const intervalMs = getYieldAccrualIntervalMs();
        const state = get();
        const activeStakes = state.stakes.filter((s) => s.status === "ACTIVE");
        if (activeStakes.length === 0) {
          set({ lastAccrualDay: utcDayKey() });
          return;
        }

        const firstEligibleAtMs = Math.min(
          ...activeStakes.map(
            (s) => (s.confirmedAt ?? s.createdAt) + getPassiveYieldDelayMs(),
          ),
        );
        if (now < firstEligibleAtMs) return;

        const lastYield = state.dailyYields.reduce<DailyYield | null>(
          (latest, row) =>
            !latest || row.createdAt > latest.createdAt ? row : latest,
          null,
        );

        const periodsDue = Math.min(
          countPassivePeriodsDue({
            nowMs: now,
            firstEligibleAtMs,
            lastAccrualAtMs: lastYield?.createdAt ?? null,
            intervalMs,
          }),
          MAX_PASSIVE_CATCHUP_PERIODS,
        );
        if (periodsDue <= 0) {
          set({ lastAccrualDay: utcDayKey() });
          return;
        }

        const capitalEligible = hasRealDepositedCapital({
          realCapital: state.realCapital,
          capitalProfileSynced: state.capitalProfileSynced,
          accountGranted: state.accountGranted,
        });
        let capital = activeStakes
          .filter((s) => stakeEligibleForPassiveYieldNow(s))
          .reduce((acc, s) => acc + s.amount, 0);
        if (!capitalEligible) {
          capital = 0;
        } else if (state.accountGranted && state.realCapital > 0) {
          capital = Math.min(capital, state.realCapital);
        }
        if (capital <= 0) {
          set({ lastAccrualDay: utcDayKey() });
          return;
        }

        const { baseYieldBps } = getPlatformSettings();
        const periodCredit = passiveCreditUsdtForPeriod(
          capital,
          baseYieldBps,
          intervalMs,
        );
        if (periodCredit <= 0) {
          set({ lastAccrualDay: utcDayKey() });
          return;
        }

        const newRecords: DailyYield[] = [];
        let earnings = state.earningsBalance;
        let totalEarned = state.totalEarned;
        let lastAccrualAtMs =
          lastYield?.createdAt ?? firstEligibleAtMs - intervalMs;

        for (let i = 0; i < periodsDue; i += 1) {
          const applied = applyEarningsCredit(
            { stakes: state.stakes, totalEarned },
            periodCredit,
          );
          if (applied <= 0) break;

          lastAccrualAtMs += intervalMs;
          newRecords.push({
            id: makeId("yld"),
            date: utcDayKey(lastAccrualAtMs),
            capitalSnapshot: capital,
            baseRateBps: baseYieldBps,
            bonusRateBps: 0,
            totalRateBps: baseYieldBps,
            wins: 0,
            losses: 0,
            creditedAmount: applied,
            createdAt: lastAccrualAtMs,
          });
          earnings += applied;
          totalEarned += applied;
        }

        if (newRecords.length === 0) {
          set({ lastAccrualDay: utcDayKey() });
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
          lastAccrualDay: utcDayKey(),
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

      applyBalanceAdjustment: ({ id, amount, note, target = "WITHDRAWABLE" }) => {
        const state = get();
        if (state.balanceAdjustments.some((a) => a.id === id)) return;

        if (target === "STAKING") {
          if (amount <= 0) return;
          const stake: Stake = {
            id: makeId("stk"),
            amount,
            network: "BSC",
            status: "ACTIVE",
            txHash: `0xadmin${id.replace(/[^a-z0-9]/gi, "").slice(0, 56)}`,
            createdAt: Date.now(),
            confirmedAt: Date.now(),
          };
          set((s) => ({
            stakes: [stake, ...s.stakes],
            balanceAdjustments: [
              {
                id,
                amount,
                note: note.trim(),
                createdAt: Date.now(),
                target: "STAKING" as const,
              },
              ...s.balanceAdjustments,
            ].slice(0, 200),
          }));
          return;
        }

        if (target === "COPY") {
          set((s) => ({
            balanceAdjustments: [
              {
                id,
                amount,
                note: note.trim(),
                createdAt: Date.now(),
                target: "COPY" as const,
              },
              ...s.balanceAdjustments,
            ].slice(0, 200),
          }));
          return;
        }

        let applied = amount;
        if (amount < 0) {
          applied = -Math.min(Math.abs(amount), state.earningsBalance);
        }
        if (applied === 0) return;

        set((s) => ({
          balanceAdjustments: [
            {
              id,
              amount: applied,
              note: note.trim(),
              createdAt: Date.now(),
              target: "WITHDRAWABLE" as const,
            },
            ...s.balanceAdjustments,
          ].slice(0, 200),
          earningsBalance: Math.max(0, s.earningsBalance + applied),
        }));
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
      partialize: (s) =>
        persistServerOwnedDataOnly()
          ? {}
          : {
              stakes: s.stakes,
              dailyYields: s.dailyYields,
              instantCredits: s.instantCredits,
              balanceAdjustments: s.balanceAdjustments,
              creditedPositionIds: s.creditedPositionIds,
              earningsBalance: s.earningsBalance,
              totalEarned: s.totalEarned,
              lastAccrualDay: s.lastAccrualDay,
            },
      version: 3,
      migrate: (persisted, version) => {
        if (persistServerOwnedDataOnly()) return initial;
        const state = persisted as Partial<StakingState>;
        if (version < 2) {
          return { ...state, pendingDeposit: null };
        }
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.pendingDeposit = null;
        if (persistServerOwnedDataOnly()) {
          Object.assign(state, initial);
        }
      },
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

export function stakeEligibleForPassiveYieldNow(stake: Stake): boolean {
  if (stake.status !== "ACTIVE") return false;
  const confirmed = stake.confirmedAt ?? stake.createdAt;
  return confirmed + getPassiveYieldDelayMs() <= Date.now();
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

