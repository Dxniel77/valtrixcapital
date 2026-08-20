import type { AdminMovement, AdminUser, AuditEntry } from "@/lib/admin/store";
import {
  billingPeriodTotal,
  type UserDetailSnapshot,
  type UserLeaderRow,
} from "@/lib/admin/analytics";
import { downloadCsv } from "@/lib/ledger";

export function exportUsersCsv(users: AdminUser[]): void {
  const header = [
    "alias",
    "wallet",
    "status",
    "account_granted",
    "capital",
    "balance",
    "total_earned",
    "referrals",
    "direct_sales",
    "withdrawal_unlocked",
    "joined_at",
  ];
  const rows = users.map((u) =>
    [
      u.alias,
      u.wallet,
      u.status,
      u.accountGranted,
      u.capital,
      u.balance,
      u.totalEarned,
      u.referrals,
      u.directSalesVolume,
      u.withdrawalUnlocked,
      new Date(u.joinedAt).toISOString(),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  downloadCsv(`valtrix-users-${dateStamp()}.csv`, [header.join(","), ...rows].join("\n"));
}

export function exportUsersBillingCsv(
  rows: UserLeaderRow[],
  period: string,
): void {
  const header = [
    "rank",
    "user",
    "wallet",
    "account_granted",
    "total",
    "operational",
    "network",
    "passive",
    "l1",
    "l2",
    "l3",
    "l4",
    "l5",
    "l6",
    "l7",
    "l8",
  ];
  const body = rows.map((r, i) =>
    [
      i + 1,
      r.user.alias,
      r.user.wallet,
      r.user.accountGranted,
      billingPeriodTotal(r),
      r.operational,
      r.network,
      r.passive,
      ...r.byLevel.map((l) => l.amount),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  downloadCsv(
    `valtrix-users-billing-${period}-${dateStamp()}.csv`,
    [header.join(","), ...body].join("\n"),
  );
}

export function exportUserDetailCsv(detail: UserDetailSnapshot): void {
  const { user, totals, networkByLevel, directReferrals } = detail;
  const lines: string[] = [
    "section,key,value",
    `profile,alias,"${user.alias}"`,
    `profile,wallet,"${user.wallet}"`,
    `profile,status,${user.status}`,
    `profile,account_granted,${user.accountGranted}`,
    `totals,capital,${totals.capital}`,
    `totals,balance,${totals.balance}`,
    `totals,total_earned,${totals.totalEarned}`,
    `totals,operational,${totals.operational}`,
    `totals,network,${totals.network}`,
    `totals,passive,${totals.passive}`,
    `totals,direct_referrals,${totals.directReferrals}`,
    `totals,network_size,${totals.networkSize}`,
    `totals,deposits,${totals.totalDeposits}`,
    `totals,withdrawals,${totals.totalWithdrawals}`,
    `totals,pending_withdrawals,${totals.pendingWithdrawals}`,
    "",
    "network_level,members,volume",
    ...networkByLevel.map(
      (l) => `L${l.level},${l.count},${l.volume}`,
    ),
    "",
    "direct_referral,alias,wallet,capital,balance",
    ...directReferrals.map(
      (r) =>
        `"${r.alias}","${r.wallet}",${r.capital},${r.balance}`,
    ),
    "",
    "date,type,amount,status,network,note",
    ...detail.movements.map((m) =>
      [
        new Date(m.timestamp).toISOString(),
        m.type,
        m.amount,
        m.status,
        m.network ?? "",
        m.note ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  downloadCsv(
    `valtrix-user-${user.alias.replace(/\s+/g, "-").toLowerCase()}-${dateStamp()}.csv`,
    lines.join("\n"),
  );
}

export function exportMovementsCsv(movements: AdminMovement[]): void {
  const header = ["date", "type", "wallet", "amount", "network", "status", "note"];
  const rows = movements.map((m) =>
    [
      new Date(m.timestamp).toISOString(),
      m.type,
      m.wallet,
      m.amount,
      m.network ?? "",
      m.status,
      m.note ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  downloadCsv(
    `valtrix-movements-${dateStamp()}.csv`,
    [header.join(","), ...rows].join("\n"),
  );
}

export function exportAuditCsv(audit: AuditEntry[]): void {
  const header = ["date", "action", "target", "detail", "actor"];
  const rows = audit.map((a) =>
    [
      new Date(a.timestamp).toISOString(),
      a.action,
      a.target,
      a.detail,
      a.actor,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  downloadCsv(`valtrix-audit-${dateStamp()}.csv`, [header.join(","), ...rows].join("\n"));
}

export function exportLeadersCsv(rows: UserLeaderRow[], period: string): void {
  exportUsersBillingCsv(rows, period);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
