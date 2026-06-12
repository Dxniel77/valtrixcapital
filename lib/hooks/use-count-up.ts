"use client";

import * as React from "react";

/** Smoothly animates toward a changing numeric target. */
export function useCountUp(target: number, decimals = 2): number {
  const [display, setDisplay] = React.useState(target);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const start = display;
    const diff = target - start;
    if (Math.abs(diff) < 10 ** -decimals) {
      setDisplay(target);
      return;
    }

    const durationMs = 600;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      const next = start + diff * eased;
      setDisplay(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from latest display when target moves
  }, [target, decimals]);

  return display;
}
