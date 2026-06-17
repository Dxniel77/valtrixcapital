"use client";

import * as React from "react";
import { useAdminStore } from "@/lib/admin/store";
import { fetchAdminUsers, fetchBackendHealth } from "@/lib/api/client";

/** Loads real users from Postgres into the admin store (replaces demo seed when DB has users). */
export function useAdminUsersSync(): void {
  const mergeUsersFromBackend = useAdminStore((s) => s.mergeUsersFromBackend);

  React.useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const health = await fetchBackendHealth();
        if (!health.database) return;
        const { users } = await fetchAdminUsers();
        if (!cancelled) mergeUsersFromBackend(users);
      } catch {
        /* keep local/demo data */
      }
    }

    void sync();
    const timer = window.setInterval(() => void sync(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [mergeUsersFromBackend]);
}
