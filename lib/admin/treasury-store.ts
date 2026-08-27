"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AdminNetwork } from "@/lib/admin/store";
import { REQUIRED_CONFIRMATIONS } from "@/lib/staking/constants";
import { persistServerOwnedDataOnly } from "@/lib/persist/production-guard";

export type TreasuryDepositStatus = "CONFIRMING" | "CONFIRMED";
export type TreasuryPoolKind = "STAKING" | "COPY";

export interface TreasuryDeposit {
  id: string;
  network: AdminNetwork;
  pool: TreasuryPoolKind;
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
  pool: TreasuryPoolKind;
  amount: number;
  toAddress: string;
  txHash: string | null;
  note: string;
  createdAt: number;
}

interface TreasuryState {
  bscBalance: number;
  polygonBalance: number;
  copyBscBalance: number;
  copyPolygonBalance: number;
  adminDeposited: number;
  paidOut: number;
  copyInflow: number;
  copyPaidOut: number;
  deposits: TreasuryDeposit[];
  withdrawals: TreasuryWithdrawal[];
  pendingDeposit: TreasuryDeposit | null;

  balanceFor: (network: AdminNetwork, pool?: TreasuryPoolKind) => number;
  totalBalance: () => number;
  copyTotalBalance: () => number;
  beginDeposit: (input: {
    amount: number;
    network: AdminNetwork;
    pool?: TreasuryPoolKind;
    txHash?: string;
  }) => void;
  advanceDepositConfirmation: () => void;
  finalizePendingDeposit: () => TreasuryDeposit | null;
  cancelPendingDeposit: () => void;
  recordWithdrawal: (input: {
    network: AdminNetwork;
    pool?: TreasuryPoolKind;
    amount: number;
    toAddress: string;
    txHash?: string;
    note?: string;
  }) => { ok: true; withdrawal: TreasuryWithdrawal } | { ok: false; error: string };
  deductForPayout: (network: AdminNetwork, amount: number) => boolean;
  hydrateFromBackend: (input: {
    bscBalance: number;
    polygonBalance: number;
    copyBscBalance?: number;
    copyPolygonBalance?: number;
    adminDeposited?: number;
    paidOut?: number;
    copyInflow?: number;
    copyPaidOut?: number;
    deposits: TreasuryDeposit[];
    withdrawals: TreasuryWithdrawal[];
  }) => void;
  setPendingDeposit: (deposit: TreasuryDeposit | null) => void;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function makeTxHash(): string {
  let out = "0x";
  const hex = "0123456789abcdef";
  for (let i = 0; i < 64; i += 1) {
    out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

export const useTreasuryStore = create<TreasuryState>()(
  persist(
    (set, get) => ({
      bscBalance: 0,
      polygonBalance: 0,
      copyBscBalance: 0,
      copyPolygonBalance: 0,
      adminDeposited: 0,
      paidOut: 0,
      copyInflow: 0,
      copyPaidOut: 0,
      deposits: [],
      withdrawals: [],
      pendingDeposit: null,

      balanceFor: (network, pool = "STAKING") => {
        const s = get();
        if (pool === "COPY") {
          return network === "POLYGON" ? s.copyPolygonBalance : s.copyBscBalance;
        }
        return network === "POLYGON" ? s.polygonBalance : s.bscBalance;
      },

      totalBalance: () => get().bscBalance + get().polygonBalance,
      copyTotalBalance: () => get().copyBscBalance + get().copyPolygonBalance,

      beginDeposit: ({ amount, network, pool = "STAKING", txHash }) => {
        const normalizedHash = txHash?.trim();
        const deposit: TreasuryDeposit = {
          id: makeId("tdep"),
          network,
          pool,
          amount,
          txHash:
            normalizedHash && /^0x[a-fA-F0-9]{64}$/.test(normalizedHash)
              ? normalizedHash
              : makeTxHash(),
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
          const pool = confirmed.pool ?? "STAKING";
          const balanceKey =
            pool === "COPY"
              ? confirmed.network === "POLYGON"
                ? "copyPolygonBalance"
                : "copyBscBalance"
              : confirmed.network === "POLYGON"
                ? "polygonBalance"
                : "bscBalance";
          return {
            pendingDeposit: null,
            deposits: [confirmed, ...s.deposits].slice(0, 100),
            [balanceKey]: s[balanceKey] + confirmed.amount,
          };
        });
        return confirmed;
      },

      cancelPendingDeposit: () => set({ pendingDeposit: null }),

      recordWithdrawal: ({ network, pool = "STAKING", amount, toAddress, txHash, note = "" }) => {
        if (amount <= 0) return { ok: false as const, error: "INVALID_AMOUNT" };
        const available = get().balanceFor(network, pool);
        if (amount > available) return { ok: false as const, error: "INSUFFICIENT_FUNDS" };
        if (!/^0x[0-9a-fA-F]{40}$/.test(toAddress)) {
          return { ok: false as const, error: "INVALID_ADDRESS" };
        }

        const withdrawal: TreasuryWithdrawal = {
          id: makeId("twd"),
          network,
          pool,
          amount,
          toAddress,
          txHash: txHash?.trim() || null,
          note: note.trim(),
          createdAt: Date.now(),
        };

        set((s) => {
          const balanceKey =
            pool === "COPY"
              ? network === "POLYGON"
                ? "copyPolygonBalance"
                : "copyBscBalance"
              : network === "POLYGON"
                ? "polygonBalance"
                : "bscBalance";
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

      hydrateFromBackend: (input) => {
        set({
          bscBalance: input.bscBalance,
          polygonBalance: input.polygonBalance,
          copyBscBalance: input.copyBscBalance ?? 0,
          copyPolygonBalance: input.copyPolygonBalance ?? 0,
          adminDeposited: input.adminDeposited ?? 0,
          paidOut: input.paidOut ?? 0,
          copyInflow: input.copyInflow ?? 0,
          copyPaidOut: input.copyPaidOut ?? 0,
          deposits: input.deposits,
          withdrawals: input.withdrawals,
          pendingDeposit: null,
        });
      },

      setPendingDeposit: (deposit) => set({ pendingDeposit: deposit }),
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
      partialize: (s) =>
        persistServerOwnedDataOnly()
          ? {}
          : {
              bscBalance: s.bscBalance,
              polygonBalance: s.polygonBalance,
              copyBscBalance: s.copyBscBalance,
              copyPolygonBalance: s.copyPolygonBalance,
              adminDeposited: s.adminDeposited,
              paidOut: s.paidOut,
              copyInflow: s.copyInflow,
              copyPaidOut: s.copyPaidOut,
              deposits: s.deposits,
              withdrawals: s.withdrawals,
            },
      onRehydrateStorage: () => (state) => {
        if (!persistServerOwnedDataOnly() || !state) return;
        state.bscBalance = 0;
        state.polygonBalance = 0;
        state.copyBscBalance = 0;
        state.copyPolygonBalance = 0;
        state.adminDeposited = 0;
        state.paidOut = 0;
        state.copyInflow = 0;
        state.copyPaidOut = 0;
        state.deposits = [];
        state.withdrawals = [];
        state.pendingDeposit = null;
      },
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
  const copyBscBalance = useTreasuryStore((s) => s.copyBscBalance);
  const copyPolygonBalance = useTreasuryStore((s) => s.copyPolygonBalance);
  const adminDeposited = useTreasuryStore((s) => s.adminDeposited);
  const paidOut = useTreasuryStore((s) => s.paidOut);
  const copyInflow = useTreasuryStore((s) => s.copyInflow);
  const copyPaidOut = useTreasuryStore((s) => s.copyPaidOut);
  return React.useMemo(
    () => ({
      bscBalance,
      polygonBalance,
      totalBalance: bscBalance + polygonBalance,
      copyBscBalance,
      copyPolygonBalance,
      copyTotalBalance: copyBscBalance + copyPolygonBalance,
      adminDeposited,
      paidOut,
      copyInflow,
      copyPaidOut,
    }),
    [
      bscBalance,
      polygonBalance,
      copyBscBalance,
      copyPolygonBalance,
      adminDeposited,
      paidOut,
      copyInflow,
      copyPaidOut,
    ],
  );
}
