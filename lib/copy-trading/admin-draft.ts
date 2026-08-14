export type DraftTargetMode = "GROWTH" | "NEUTRAL" | "HARVEST";

/** Picks a trader return inside its limits and in the selected mode's direction. */
export function draftReturnBps(
  minBps: number,
  maxBps: number,
  mode: DraftTargetMode,
  random: () => number = Math.random,
): number {
  if (minBps === maxBps) return minBps;
  const lo = Math.min(minBps, maxBps);
  const hi = Math.max(minBps, maxBps);
  let draftLo = lo;
  let draftHi = hi;

  if (mode === "GROWTH" && hi > 0) {
    draftLo = Math.max(1, lo);
  } else if (mode === "HARVEST" && lo < 0) {
    draftHi = Math.min(-1, hi);
  }

  return draftLo + Math.floor(random() * (draftHi - draftLo + 1));
}
