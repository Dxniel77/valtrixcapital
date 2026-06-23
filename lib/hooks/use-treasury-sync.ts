"use client";

import * as React from "react";
import { syncTreasuryFromBackend } from "@/lib/admin/treasury-backend";

/** Hydrates admin treasury from Postgres on mount. */
export function useTreasurySync(): void {
  React.useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        if (!cancelled) await syncTreasuryFromBackend();
      } catch {
        /* keep local treasury */
      }
    }

    void sync();
    const timer = window.setInterval(() => void sync(), 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
}
