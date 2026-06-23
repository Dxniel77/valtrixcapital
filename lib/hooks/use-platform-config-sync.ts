"use client";

import * as React from "react";
import { syncPlatformConfigFromBackend } from "@/lib/platform/config-sync";

/** Hydrates platform settings from Postgres on admin mount. */
export function usePlatformConfigSync(): void {
  React.useEffect(() => {
    let cancelled = false;
    void syncPlatformConfigFromBackend().catch(() => undefined);
    const timer = window.setInterval(() => {
      if (cancelled) return;
      void syncPlatformConfigFromBackend().catch(() => undefined);
    }, 300_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
}
