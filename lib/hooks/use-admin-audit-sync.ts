"use client";

import * as React from "react";
import { fetchAdminAudit } from "@/lib/api/client";
import { useAdminStore, type AuditEntry } from "@/lib/admin/store";
import { loadBackendAvailability } from "@/lib/hooks/use-backend-sync";
import { shortenAddress } from "@/lib/utils";
import { formatAuditPayload } from "@/lib/admin/audit-format";

function auditActionLabel(
  action: string,
  payload: Record<string, unknown> | null,
): string {
  if (action === "APPROVE_WITHDRAWAL" && payload?.automatic === true) {
    return "WITHDRAWAL_AUTO_PAID";
  }
  switch (action) {
    case "ACTIVATE":
      return "USER_ACTIVATED";
    case "DEACTIVATE":
      return "USER_DEACTIVATED";
    case "ADJUST_BALANCE":
      return "BALANCE_ADJUSTED";
    case "APPROVE_WITHDRAWAL":
      return "WITHDRAWAL_APPROVED";
    case "REJECT_WITHDRAWAL":
      return "WITHDRAWAL_REJECTED";
    case "UPDATE_CONFIG":
      return "SETTINGS_UPDATED";
    default:
      return action;
  }
}

function mapBackendAuditRow(
  row: Awaited<ReturnType<typeof fetchAdminAudit>>["audit"][number],
): AuditEntry {
  const payload = (row.payload as Record<string, unknown> | null) ?? null;
  const detail = formatAuditPayload(row.action, payload);

  return {
    id: row.id,
    action: auditActionLabel(row.action, payload),
    target: row.target ? shortenAddress(row.target) : "—",
    detail: detail || row.action,
    actor: shortenAddress(row.actor),
    timestamp: row.timestamp,
  };
}

/** Loads admin audit log from Postgres when available. */
export function useAdminAuditSync(): void {
  const setAuditFromBackend = useAdminStore((s) => s.setAuditFromBackend);

  React.useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const available = await loadBackendAvailability();
        if (!available || cancelled) return;
        const { audit } = await fetchAdminAudit();
        if (!cancelled && audit.length > 0) {
          setAuditFromBackend(audit.map(mapBackendAuditRow));
        }
      } catch {
        /* keep local audit */
      }
    }

    void sync();
    const timer = window.setInterval(() => void sync(), 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setAuditFromBackend]);
}
