"use client";

import * as React from "react";

/** `null` until after mount — safe for SSR/hydration. */
export function useClientNow(intervalMs = 1000): number | null {
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
