"use client";

import * as React from "react";
import { refreshAdminMovementsFromBackend } from "@/lib/admin/movements-backend";
import { useAdminStore } from "@/lib/admin/store";
import { loadBackendAvailability } from "@/lib/hooks/use-backend-sync";

/** Loads admin movements from Postgres (replaces local ledger when DB is available). */
export function useAdminMovementsSync(): void {
  const replaceMovementsFromBackend = useAdminStore(
    (s) => s.replaceMovementsFromBackend,
  );

  React.useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const available = await loadBackendAvailability();
        if (!available || cancelled) return;
        await refreshAdminMovementsFromBackend();
      } catch {
        /* keep local/demo data */
      }
    }

    void sync();
    const timer = window.setInterval(() => void sync(), 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [replaceMovementsFromBackend]);
}
