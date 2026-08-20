"use client";

import * as React from "react";
import { fetchAdminAudit } from "@/lib/api/client";
import { useAdminStore, type AuditEntry } from "@/lib/admin/store";
import { loadBackendAvailability } from "@/lib/hooks/use-backend-sync";
import { shortenAddress } from "@/lib/utils";
import { formatAuditPayload, auditActionLabel } from "@/lib/admin/audit-format";

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

export async function refreshAdminAuditFromBackend(): Promise<void> {
  const { audit } = await fetchAdminAudit();
  if (audit.length > 0) {
    useAdminStore.getState().setAuditFromBackend(audit.map(mapBackendAuditRow));
  }
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
