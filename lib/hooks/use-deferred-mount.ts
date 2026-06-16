"use client";

import * as React from "react";

/** Mount children only after the browser is idle — keeps first paint fast. */
export function useDeferredMount(timeoutMs = 1500): boolean {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setReady(true), {
        timeout: timeoutMs,
      });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(id);
  }, [timeoutMs]);

  return ready;
}
