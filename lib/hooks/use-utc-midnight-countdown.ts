"use client";

import * as React from "react";
import { nextUtcMidnightMs } from "@/lib/utils";
import { useClientNow } from "@/lib/hooks/use-client-now";

/** Ms until next UTC midnight; `null` until after mount (SSR-safe). */
export function useUtcMidnightCountdown(intervalMs = 1000): number | null {
  const now = useClientNow(intervalMs);
  return React.useMemo(
    () => (now !== null ? nextUtcMidnightMs(now) : null),
    [now],
  );
}
