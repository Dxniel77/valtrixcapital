import type { WithdrawalStatus } from "@/lib/wallet/store";

/** Treat CONFIRMED/COMPLETED without a chain hash as still processing — not paid out. */
export function resolveWithdrawalUiStatus(w: {
  status: WithdrawalStatus | string;
  txHash: string | null;
}): WithdrawalStatus {
  const status = w.status as WithdrawalStatus;
  if (status === "COMPLETED" && !w.txHash?.trim()) {
    return "PROCESSING";
  }
  return status;
}

export function isWithdrawalPaidOut(w: {
  status: WithdrawalStatus | string;
  txHash: string | null;
}): boolean {
  return w.status === "COMPLETED" && Boolean(w.txHash?.trim());
}

export function isWithdrawalPending(w: {
  status: WithdrawalStatus | string;
  txHash: string | null;
}): boolean {
  const ui = resolveWithdrawalUiStatus(w);
  return ui !== "COMPLETED" && ui !== "REJECTED";
}
