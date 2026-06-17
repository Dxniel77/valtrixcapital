/** UTC day the public company-metrics feed starts accumulating. */
export const COMPANY_METRICS_LAUNCH_MS = Date.parse(
  "2025-03-15T00:00:00.000Z",
);

/** Live bot / liquidation tables only show this much history. */
export const LIVE_FEED_WINDOW_MS = 5 * 60 * 1000;

export function liveFeedSlotCount(cadenceMs: number): number {
  return Math.max(1, Math.ceil(LIVE_FEED_WINDOW_MS / cadenceMs));
}

export function utcDateKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function slotIndexAt(ts: number, cadenceMs: number): number {
  return Math.floor(ts / cadenceMs);
}

export function slotTimestamp(slotIndex: number, cadenceMs: number): number {
  return slotIndex * cadenceMs;
}

export function daySlotBounds(
  dayKey: string,
  cadenceMs: number,
): { first: number; last: number } | null {
  const dayStart = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(dayStart)) return null;
  const dayEnd = dayStart + 86_400_000 - 1;
  const first = Math.ceil(dayStart / cadenceMs);
  const last = Math.floor(dayEnd / cadenceMs);
  if (last < first) return null;
  return { first, last };
}

export function launchSlotIndex(cadenceMs: number): number {
  return slotIndexAt(COMPANY_METRICS_LAUNCH_MS, cadenceMs);
}

/** Iterate UTC day keys from launch through `toDay` inclusive. */
export function* dayKeysThrough(toDay: string): Generator<string> {
  const end = Date.parse(`${toDay}T00:00:00.000Z`);
  const cursor = new Date(COMPANY_METRICS_LAUNCH_MS);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() <= end) {
    yield utcDateKey(cursor.getTime());
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}
