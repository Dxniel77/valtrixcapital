"use client";

import * as React from "react";
import { useAdminStore } from "@/lib/admin/store";
import { fetchAdminUsers } from "@/lib/api/client";
import { loadBackendAvailability } from "@/lib/hooks/use-backend-sync";

/** Loads real users from Postgres into the admin store (replaces demo seed when DB has users). */
export function useAdminUsersSync(): void {
  const mergeUsersFromBackend = useAdminStore((s) => s.mergeUsersFromBackend);

  React.useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const available = await loadBackendAvailability();
        if (!available || cancelled) return;
        const { users } = await fetchAdminUsers();
        if (!cancelled) mergeUsersFromBackend(users);
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
  }, [mergeUsersFromBackend]);
}
