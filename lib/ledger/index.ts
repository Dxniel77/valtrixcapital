"use client";

import * as React from "react";
import { useStakingStore, type StakingNetwork } from "@/lib/staking/store";
import { useTradeStore } from "@/lib/trade/store";
import { useReferralsStore } from "@/lib/referrals/store";
import { useWalletStore } from "@/lib/wallet/store";

export type LedgerCategory =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "YIELD"
  | "COMMISSION"
  | "TRADE";

export interface LedgerEntry {
  id: string;
  category: LedgerCategory;
  timestamp: number;
  /** Signed USDT amount: credits positive, debits negative. */
  amount: number;
  network: StakingNetwork | null;
  txHash: string | null;
  /** Domain status, e.g. ACTIVE / PENDING / COMPLETED / WIN / LOSS. */
  status: string | null;
  pair?: string;
  direction?: "UP" | "DOWN";
  level?: number;
  sourceWallet?: string;
  fee?: number;
}

export function useLedger(): LedgerEntry[] {
  const stakes = useStakingStore((s) => s.stakes);
  const pendingDeposit = useStakingStore((s) => s.pendingDeposit);
  const dailyYields = useStakingStore((s) => s.dailyYields);
  const positions = useTradeStore((s) => s.positions);
  const commissions = useReferralsStore((s) => s.commissions);
  const withdrawals = useWalletStore((s) => s.withdrawals);

  return React.useMemo(() => {
    const entries: LedgerEntry[] = [];

    for (const st of stakes) {
      entries.push({
        id: `dep_${st.id}`,
        category: "DEPOSIT",
        timestamp: st.confirmedAt ?? st.createdAt,
        amount: st.amount,
        network: st.network,
        txHash: st.txHash,
        status: st.status,
      });
    }

    if (pendingDeposit) {
      entries.push({
        id: `dep_pending_${pendingDeposit.id}`,
        category: "DEPOSIT",
        timestamp: pendingDeposit.startedAt,
        amount: pendingDeposit.amount,
        network: pendingDeposit.network,
        txHash: pendingDeposit.txHash,
        status: "PENDING",
      });
    }

    for (const w of withdrawals) {
      entries.push({
        id: `wd_${w.id}`,
        category: "WITHDRAWAL",
        timestamp: w.createdAt,
        amount: -w.amount,
        network: w.network,
        txHash: w.txHash,
        status: w.status,
        fee: w.fee,
      });
    }

    for (const y of dailyYields) {
      entries.push({
        id: `yld_${y.id}`,
        category: "YIELD",
        timestamp: y.createdAt,
        amount: y.creditedAmount,
        network: null,
        txHash: null,
        status: null,
      });
    }

    for (const c of commissions) {
      entries.push({
        id: `com_${c.id}`,
        category: "COMMISSION",
        timestamp: c.createdAt,
        amount: c.amount,
        network: null,
        txHash: null,
        status: null,
        level: c.level,
        sourceWallet: c.sourceWallet,
      });
    }

    for (const p of positions) {
      entries.push({
        id: `trd_${p.id}`,
        category: "TRADE",
        timestamp: p.openedAt,
        amount: 0,
        network: null,
        txHash: null,
        status: p.status,
        pair: p.pair,
        direction: p.direction,
      });
    }

    entries.sort((a, b) => b.timestamp - a.timestamp);
    return entries;
  }, [stakes, pendingDeposit, dailyYields, positions, commissions, withdrawals]);
}

export function ledgerToCsv(entries: LedgerEntry[]): string {
  const header = [
    "date_utc",
    "category",
    "amount_usdt",
    "network",
    "status",
    "tx_hash",
    "detail",
  ];
  const rows = entries.map((e) => {
    const detail =
      e.category === "TRADE"
        ? `${e.pair ?? ""} ${e.direction ?? ""}`.trim()
        : e.category === "COMMISSION"
          ? `L${e.level ?? ""} ${e.sourceWallet ?? ""}`.trim()
          : e.category === "WITHDRAWAL"
            ? `fee ${e.fee ?? 0}`
            : "";
    return [
      new Date(e.timestamp).toISOString(),
      e.category,
      e.amount.toFixed(6),
      e.network ?? "",
      e.status ?? "",
      e.txHash ?? "",
      detail,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
