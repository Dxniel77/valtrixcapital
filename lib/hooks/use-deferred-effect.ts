"use client";

import * as React from "react";

/** Runs an effect after the first paint so navigation feels instant. */
export function useDeferredEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList,
  timeoutMs = 2000,
): void {
  React.useEffect(() => {
    let cancelled = false;
    let cleanup: void | (() => void);

    const run = () => {
      if (cancelled) return;
      cleanup = effect();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: timeoutMs });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
        cleanup?.();
      };
    }

    const id = globalThis.setTimeout(run, 0);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(id);
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, deps);
}
