"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useStakingStore, type StakingNetwork } from "@/lib/staking/store";
import { getPlatformSettings } from "@/lib/platform/settings-store";
import { computeWithdrawal } from "./constants";
import { useTreasuryStore } from "@/lib/admin/treasury-store";
import { persistServerOwnedDataOnly } from "@/lib/persist/production-guard";

export type WithdrawalStatus =
  | "REQUESTED"
  | "REVIEW"
  | "PROCESSING"
  | "COMPLETED"
  | "REJECTED";

export interface Withdrawal {
  id: string;
  amount: number;
  feeBps: number;
  fee: number;
  netAmount: number;
  network: StakingNetwork;
  destination: string;
  status: WithdrawalStatus;
  txHash: string | null;
  createdAt: number;
  updatedAt: number;
  note?: string;
}

/** Ordered status timeline used by the tracker UI. */
export const WITHDRAWAL_FLOW: WithdrawalStatus[] = [
  "REQUESTED",
  "REVIEW",
  "PROCESSING",
  "COMPLETED",
];

interface WalletState {
  withdrawals: Withdrawal[];

  requestWithdrawal: (input: {
    amount: number;
    network: StakingNetwork;
    destination: string;
  }) => Withdrawal | { error: string };
  advanceWithdrawals: () => void;
  rejectWithdrawal: (id: string, note?: string) => void;
  adminSetWithdrawalStatus: (
    id: string,
    status: WithdrawalStatus,
    txHash?: string,
  ) => void;
  reset: () => void;
}

function makeId(): string {
  return `wd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      withdrawals: [],

      requestWithdrawal: ({ amount, network, destination }) => {
        const { withdrawalFeeBps, minWithdrawalUsdt } = getPlatformSettings();
        const breakdown = computeWithdrawal(amount, withdrawalFeeBps);
        const available = useStakingStore.getState().earningsBalance;
        if (breakdown.amount <= 0) return { error: "INVALID_AMOUNT" };
        if (breakdown.amount < minWithdrawalUsdt) return { error: "BELOW_MINIMUM" };
        if (breakdown.amount > available) return { error: "INSUFFICIENT_FUNDS" };

        const poolAvailable = useTreasuryStore.getState().balanceFor(network);
        if (breakdown.netAmount > poolAvailable) {
          return { error: "INSUFFICIENT_TREASURY" };
        }

        const now = Date.now();
        const wd: Withdrawal = {
          id: makeId(),
          amount: breakdown.amount,
          feeBps: breakdown.feeBps,
          fee: breakdown.fee,
          netAmount: breakdown.netAmount,
          network,
          destination,
          status: "REQUESTED",
          txHash: null,
          createdAt: now,
          updatedAt: now,
        };

        useStakingStore.setState((s) => ({
          earningsBalance: Math.max(0, s.earningsBalance - breakdown.amount),
        }));

        set((s) => ({ withdrawals: [wd, ...s.withdrawals] }));
        return wd;
      },

      advanceWithdrawals: () => {
        /* Payouts require admin confirmation with a real on-chain tx hash. */
      },

      rejectWithdrawal: (id, note) => {
        const target = get().withdrawals.find((w) => w.id === id);
        if (!target) return;
        if (target.status === "COMPLETED" || target.status === "REJECTED") return;
        useStakingStore.setState((s) => ({
          earningsBalance: s.earningsBalance + target.amount,
        }));
        set((s) => ({
          withdrawals: s.withdrawals.map((w) =>
            w.id === id
              ? { ...w, status: "REJECTED", note, updatedAt: Date.now() }
              : w,
          ),
        }));
      },

      adminSetWithdrawalStatus: (id, status, txHash) => {
        const target = get().withdrawals.find((w) => w.id === id);
        if (!target) return;
        if (target.status === "COMPLETED" || target.status === "REJECTED") return;

        if (status === "REJECTED") {
          get().rejectWithdrawal(id);
          return;
        }

        if (status === "COMPLETED") {
          const hash = txHash?.trim() || target.txHash?.trim();
          if (!hash) return;
        }

        const now = Date.now();
        set((s) => ({
          withdrawals: s.withdrawals.map((w) =>
            w.id === id
              ? {
                  ...w,
                  status,
                  txHash:
                    status === "COMPLETED"
                      ? txHash?.trim() || w.txHash
                      : w.txHash,
                  updatedAt: now,
                }
              : w,
          ),
        }));
      },

      reset: () => set({ withdrawals: [] }),
    }),
    {
      name: "valtrix.wallet.v1",
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
        persistServerOwnedDataOnly() ? {} : { withdrawals: s.withdrawals },
      onRehydrateStorage: () => (state) => {
        if (persistServerOwnedDataOnly() && state) {
          state.withdrawals = [];
        }
      },
    },
  ),
);

export function useWalletStoreHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const unsub = useWalletStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useWalletStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

/** No-op: withdrawal progress is driven by admin payout + server sync. */
export function useWithdrawalEngine(): void {}
