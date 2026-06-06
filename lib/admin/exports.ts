import type { AdminMovement, AdminUser, AuditEntry } from "@/lib/admin/store";
import type { UserLeaderRow } from "@/lib/admin/analytics";
import { downloadCsv } from "@/lib/ledger";

export function exportUsersCsv(users: AdminUser[]): void {
  const header = [
    "alias",
    "wallet",
    "status",
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

export function exportMovementsCsv(movements: AdminMovement[]): void {
  const header = ["date", "type", "wallet", "amount", "network", "status"];
  const rows = movements.map((m) =>
    [
      new Date(m.timestamp).toISOString(),
      m.type,
      m.wallet,
      m.amount,
      m.network ?? "",
      m.status,
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
  const header = [
    "rank",
    "user",
    "wallet",
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
      r.total,
      r.operational,
      r.network,
      r.passive,
      ...r.byLevel.map((l) => l.amount),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  downloadCsv(
    `valtrix-leaders-${period}-${dateStamp()}.csv`,
    [header.join(","), ...body].join("\n"),
  );
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
