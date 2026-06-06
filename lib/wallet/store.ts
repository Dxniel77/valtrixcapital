"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useStakingStore, type StakingNetwork } from "@/lib/staking/store";
import {
  WITHDRAWAL_FEE_BPS,
  computeWithdrawal,
} from "./constants";

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
  reset: () => void;
}

function makeId(): string {
  return `wd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeTxHash(): string {
  let out = "0x";
  const hex = "0123456789abcdef";
  for (let i = 0; i < 64; i += 1) out += hex[Math.floor(Math.random() * 16)];
  return out;
}

/** Simulated dwell time (ms) for each pending status before auto-advancing. */
const STATUS_DWELL_MS: Partial<Record<WithdrawalStatus, number>> = {
  REQUESTED: 2_000,
  REVIEW: 2_000,
  PROCESSING: 2_000,
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      withdrawals: [],

      requestWithdrawal: ({ amount, network, destination }) => {
        const breakdown = computeWithdrawal(amount, WITHDRAWAL_FEE_BPS);
        const available = useStakingStore.getState().earningsBalance;
        if (breakdown.amount <= 0) return { error: "INVALID_AMOUNT" };
        if (breakdown.amount > available) return { error: "INSUFFICIENT_FUNDS" };

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

        // Reserve the funds immediately (debit available balance).
        useStakingStore.setState((s) => ({
          earningsBalance: Math.max(0, s.earningsBalance - breakdown.amount),
        }));

        set((s) => ({ withdrawals: [wd, ...s.withdrawals] }));
        return wd;
      },

      advanceWithdrawals: () => {
        const now = Date.now();
        let changed = false;
        const withdrawals = get().withdrawals.map((w) => {
          const idx = WITHDRAWAL_FLOW.indexOf(w.status);
          if (idx < 0 || w.status === "COMPLETED") return w;
          const dwell = STATUS_DWELL_MS[w.status];
          if (dwell == null) return w;
          if (now - w.updatedAt < dwell) return w;
          const next = WITHDRAWAL_FLOW[idx + 1];
          if (!next) return w;
          changed = true;
          return {
            ...w,
            status: next,
            updatedAt: now,
            txHash: next === "COMPLETED" ? makeTxHash() : w.txHash,
          };
        });
        if (changed) set({ withdrawals });
      },

      rejectWithdrawal: (id, note) => {
        const target = get().withdrawals.find((w) => w.id === id);
        if (!target) return;
        if (target.status === "COMPLETED" || target.status === "REJECTED") return;
        // Refund the reserved amount back to the available balance.
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
      partialize: (s) => ({ withdrawals: s.withdrawals }),
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

/** Drives the withdrawal status tracker forward while any are in-flight. */
export function useWithdrawalEngine(): void {
  const hydrated = useWalletStoreHydrated();
  const advance = useWalletStore((s) => s.advanceWithdrawals);
  const withdrawals = useWalletStore((s) => s.withdrawals);

  const hasPending = withdrawals.some(
    (w) => w.status !== "COMPLETED" && w.status !== "REJECTED",
  );

  React.useEffect(() => {
    if (!hydrated || !hasPending) return;
    advance();
    const id = window.setInterval(advance, 1_500);
    return () => window.clearInterval(id);
  }, [hydrated, hasPending, advance]);
}
