import {
  adminCreateTreasuryDeposit,
  adminRecordTreasuryWithdrawal,
  adminUpdateTreasuryDeposit,
  fetchAdminTreasury,
} from "@/lib/api/client";
import {
  useTreasuryStore,
  type TreasuryDeposit,
  type TreasuryPoolKind,
  type TreasuryWithdrawal,
} from "@/lib/admin/treasury-store";
import { loadBackendAvailability } from "@/lib/hooks/use-backend-sync";
import { refreshAdminMovementsFromBackend } from "@/lib/admin/movements-backend";

function mapDeposit(row: {
  id: string;
  network: "BSC" | "POLYGON";
  pool?: TreasuryPoolKind;
  amount: number;
  txHash: string;
  confirmations: number;
  requiredConfirmations: number;
  status: "CONFIRMING" | "CONFIRMED";
  startedAt: string;
}): TreasuryDeposit {
  return {
    id: row.id,
    network: row.network,
    pool: row.pool ?? "STAKING",
    amount: row.amount,
    txHash: row.txHash,
    startedAt: Date.parse(row.startedAt) || Date.now(),
    confirmations: row.confirmations,
    requiredConfirmations: row.requiredConfirmations,
    status: row.status === "CONFIRMED" ? "CONFIRMED" : "CONFIRMING",
  };
}

function mapWithdrawal(row: {
  id: string;
  network: "BSC" | "POLYGON";
  pool?: TreasuryPoolKind;
  amount: number;
  toAddress: string;
  txHash: string | null;
  note: string;
  createdAt: string;
}): TreasuryWithdrawal {
  return {
    id: row.id,
    network: row.network,
    pool: row.pool ?? "STAKING",
    amount: row.amount,
    toAddress: row.toAddress,
    txHash: row.txHash,
    note: row.note,
    createdAt: Date.parse(row.createdAt) || Date.now(),
  };
}

/** Loads treasury balances and ledger from Postgres. */
export async function syncTreasuryFromBackend(): Promise<boolean> {
  const available = await loadBackendAvailability();
  if (!available) return false;

  const res = await fetchAdminTreasury();
  if (!res.backend || !res.treasury) return false;

  const deposits = res.treasury.deposits.map(mapDeposit);
  const pendingConfirming = deposits.find((d) => d.status === "CONFIRMING") ?? null;

  useTreasuryStore.getState().hydrateFromBackend({
    bscBalance: res.treasury.balances.bscBalance,
    polygonBalance: res.treasury.balances.polygonBalance,
    copyBscBalance: res.treasury.balances.copyBscBalance ?? 0,
    copyPolygonBalance: res.treasury.balances.copyPolygonBalance ?? 0,
    adminDeposited: res.treasury.totals.adminDeposited,
    paidOut: res.treasury.totals.paidOut,
    copyInflow: res.treasury.totals.copyInflow ?? 0,
    copyPaidOut: res.treasury.totals.copyPaidOut ?? 0,
    deposits,
    withdrawals: res.treasury.withdrawals.map(mapWithdrawal),
  });

  if (pendingConfirming) {
    useTreasuryStore.getState().setPendingDeposit(pendingConfirming);
  }

  return true;
}

export async function beginTreasuryDepositOnBackend(input: {
  network: "BSC" | "POLYGON";
  pool?: TreasuryPoolKind;
  amount: number;
  txHash: string;
  requiredConfirmations: number;
}): Promise<TreasuryDeposit> {
  const res = await adminCreateTreasuryDeposit(input);
  const deposit = mapDeposit(res.deposit);
  useTreasuryStore.getState().setPendingDeposit(deposit);
  return deposit;
}

export async function advanceTreasuryDepositOnBackend(
  depositId: string,
): Promise<TreasuryDeposit> {
  const res = await adminUpdateTreasuryDeposit(depositId, {});
  const deposit = mapDeposit(res.deposit);
  if (deposit.status === "CONFIRMING") {
    useTreasuryStore.getState().setPendingDeposit(deposit);
  }
  return deposit;
}

export async function confirmTreasuryDepositOnBackend(
  depositId: string,
): Promise<TreasuryDeposit> {
  const res = await adminUpdateTreasuryDeposit(depositId, { confirm: true });
  await syncTreasuryFromBackend();
  await refreshAdminMovementsFromBackend();
  return mapDeposit(res.deposit);
}

export async function recordTreasuryWithdrawalOnBackend(input: {
  network: "BSC" | "POLYGON";
  pool?: TreasuryPoolKind;
  amount: number;
  toAddress: string;
  txHash?: string;
  note?: string;
}): Promise<void> {
  await adminRecordTreasuryWithdrawal(input);
  await syncTreasuryFromBackend();
  await refreshAdminMovementsFromBackend();
}
