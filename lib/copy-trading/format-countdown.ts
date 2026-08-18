/** Remaining time with units so `10:31:36` is never read as a clock or as 10 minutes. */
export function formatCopyRemaining(iso: string, nowMs: number): string | null {
  const remaining = new Date(iso).getTime() - nowMs;
  if (!Number.isFinite(remaining)) return null;
  if (remaining <= 0) return "due";
  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatCopyClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
