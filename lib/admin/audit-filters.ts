import type { AuditEntry } from "@/lib/admin/store";

export type AuditBadgeVariant =
  | "success"
  | "danger"
  | "info"
  | "gold"
  | "warning"
  | "default";

export type AuditSeverity = "critical" | "money" | "warning" | "routine";

export const AUDIT_ACTION_VARIANT: Record<string, AuditBadgeVariant> = {
  USER_ACTIVATED: "success",
  USER_DEACTIVATED: "danger",
  USER_PROFILE_UPDATED: "info",
  BALANCE_ADJUSTED: "gold",
  COPY_BALANCE_ADJUSTED: "gold",
  SETTINGS_UPDATED: "info",
  SPONSORSHIP_UPDATED: "gold",
  ACCOUNT_GRANTED: "gold",
  ACCOUNT_DELETED: "danger",
  ACCOUNT_DELETION_APPROVED: "danger",
  ACCOUNT_DELETION_CANCELLED: "warning",
  ACCOUNT_DELETION_PROCESSED: "warning",
  WITHDRAWAL_AUTO_PAID: "success",
  WITHDRAWAL_APPROVED: "info",
  WITHDRAWAL_REJECTED: "danger",
  WITHDRAWAL_PROCESSED: "info",
  WITHDRAWAL_ALLOWANCE_RELEASED: "gold",
  MANUAL_PAYOUT_RECONCILED: "warning",
  SPONSOR_TERMS_UPDATED: "info",
  IB_STRATEGY_CREATED: "info",
  IB_STRATEGY_UPDATED: "info",
  IB_STRATEGY_ASSIGNED: "info",
  IB_AGREEMENT_UPDATED: "info",
  IB_NET_DEPOSIT_CREDITED: "gold",
  TREASURY_DEPOSIT: "gold",
  TREASURY_WITHDRAW: "gold",
  SPONSOR_CHANGED: "warning",
};

const VARIANT_SEVERITY: Record<AuditBadgeVariant, AuditSeverity> = {
  danger: "critical",
  gold: "money",
  warning: "warning",
  success: "routine",
  info: "routine",
  default: "routine",
};

export function auditActionVariant(action: string): AuditBadgeVariant {
  return AUDIT_ACTION_VARIANT[action] ?? "default";
}

export function auditActionSeverity(action: string): AuditSeverity {
  return VARIANT_SEVERITY[auditActionVariant(action)];
}

export function uniqueAuditActions(rows: AuditEntry[]): string[] {
  return [...new Set(rows.map((row) => row.action))].sort((a, b) =>
    a.localeCompare(b),
  );
}
