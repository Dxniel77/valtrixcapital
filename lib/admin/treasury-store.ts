"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AdminNetwork } from "@/lib/admin/store";
import { REQUIRED_CONFIRMATIONS } from "@/lib/staking/constants";

export type TreasuryDepositStatus = "CONFIRMING" | "CONFIRMED";

export interface TreasuryDeposit {
  id: string;
  network: AdminNetwork;
  amount: number;
  txHash: string;
  startedAt: number;
  confirmations: number;
  requiredConfirmations: number;
  status: TreasuryDepositStatus;
}

export interface TreasuryWithdrawal {
  id: string;
  network: AdminNetwork;
  amount: number;
  toAddress: string;
  txHash: string | null;
  note: string;
  createdAt: number;
}

interface TreasuryState {
  bscBalance: number;
  polygonBalance: number;
  deposits: TreasuryDeposit[];
  withdrawals: TreasuryWithdrawal[];
  pendingDeposit: TreasuryDeposit | null;

  balanceFor: (network: AdminNetwork) => number;
  totalBalance: () => number;
  beginDeposit: (input: {
    amount: number;
    network: AdminNetwork;
    txHash: string;
  }) => void;
  advanceDepositConfirmation: () => void;
  finalizePendingDeposit: () => TreasuryDeposit | null;
  cancelPendingDeposit: () => void;
  recordWithdrawal: (input: {
    network: AdminNetwork;
    amount: number;
    toAddress: string;
    txHash?: string;
    note?: string;
  }) => { ok: true; withdrawal: TreasuryWithdrawal } | { ok: false; error: string };
  deductForPayout: (network: AdminNetwork, amount: number) => boolean;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const useTreasuryStore = create<TreasuryState>()(
  persist(
    (set, get) => ({
      bscBalance: 0,
      polygonBalance: 0,
      deposits: [],
      withdrawals: [],
      pendingDeposit: null,

      balanceFor: (network) =>
        network === "POLYGON" ? get().polygonBalance : get().bscBalance,

      totalBalance: () => get().bscBalance + get().polygonBalance,

      beginDeposit: ({ amount, network, txHash }) => {
        const deposit: TreasuryDeposit = {
          id: makeId("tdep"),
          network,
          amount,
          txHash,
          startedAt: Date.now(),
          confirmations: 0,
          requiredConfirmations: REQUIRED_CONFIRMATIONS,
          status: "CONFIRMING",
        };
        set({ pendingDeposit: deposit });
      },

      advanceDepositConfirmation: () => {
        const pending = get().pendingDeposit;
        if (!pending || pending.status !== "CONFIRMING") return;
        const next = Math.min(
          pending.confirmations + 1,
          pending.requiredConfirmations,
        );
        set({
          pendingDeposit: { ...pending, confirmations: next },
        });
      },

      finalizePendingDeposit: () => {
        const pending = get().pendingDeposit;
        if (
          !pending ||
          pending.confirmations < pending.requiredConfirmations
        ) {
          return null;
        }
        const confirmed: TreasuryDeposit = {
          ...pending,
          status: "CONFIRMED",
        };
        set((s) => {
          const balanceKey =
            confirmed.network === "POLYGON" ? "polygonBalance" : "bscBalance";
          return {
            pendingDeposit: null,
            deposits: [confirmed, ...s.deposits].slice(0, 100),
            [balanceKey]: s[balanceKey] + confirmed.amount,
          };
        });
        return confirmed;
      },

      cancelPendingDeposit: () => set({ pendingDeposit: null }),

      recordWithdrawal: ({ network, amount, toAddress, txHash, note = "" }) => {
        if (amount <= 0) return { ok: false as const, error: "INVALID_AMOUNT" };
        const available = get().balanceFor(network);
        if (amount > available) return { ok: false as const, error: "INSUFFICIENT_FUNDS" };
        if (!/^0x[0-9a-fA-F]{40}$/.test(toAddress)) {
          return { ok: false as const, error: "INVALID_ADDRESS" };
        }

        const withdrawal: TreasuryWithdrawal = {
          id: makeId("twd"),
          network,
          amount,
          toAddress,
          txHash: txHash?.trim() || null,
          note: note.trim(),
          createdAt: Date.now(),
        };

        set((s) => {
          const balanceKey =
            network === "POLYGON" ? "polygonBalance" : "bscBalance";
          return {
            withdrawals: [withdrawal, ...s.withdrawals].slice(0, 100),
            [balanceKey]: s[balanceKey] - amount,
          };
        });

        return { ok: true as const, withdrawal };
      },

      deductForPayout: (network, amount) => {
        if (amount <= 0) return true;
        const available = get().balanceFor(network);
        if (amount > available) return false;
        set((s) => {
          const balanceKey =
            network === "POLYGON" ? "polygonBalance" : "bscBalance";
          return { [balanceKey]: s[balanceKey] - amount };
        });
        return true;
      },
    }),
    {
      name: "valtrix.treasury.v1",
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
        bscBalance: s.bscBalance,
        polygonBalance: s.polygonBalance,
        deposits: s.deposits,
        withdrawals: s.withdrawals,
      }),
    },
  ),
);

export function useTreasuryStoreHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const unsub = useTreasuryStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useTreasuryStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

export function useTreasurySummary() {
  const bscBalance = useTreasuryStore((s) => s.bscBalance);
  const polygonBalance = useTreasuryStore((s) => s.polygonBalance);
  return React.useMemo(
    () => ({
      bscBalance,
      polygonBalance,
      totalBalance: bscBalance + polygonBalance,
    }),
    [bscBalance, polygonBalance],
  );
}
