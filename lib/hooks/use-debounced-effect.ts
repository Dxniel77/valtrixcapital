"use client";

import * as React from "react";

/** Debounced effect — batches rapid store updates into a single run. */
export function useDebouncedEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList,
  delayMs = 400,
): void {
  React.useEffect(() => {
    let cleanup: void | (() => void);
    const id = window.setTimeout(() => {
      cleanup = effect();
    }, delayMs);
    return () => {
      window.clearTimeout(id);
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, deps);
}
