const DAY_MS = 24 * 60 * 60 * 1000;

export function lossGraceCutoff(cutoff: Date, lossGraceDays: number): Date {
  return new Date(
    cutoff.getTime() - Math.max(0, Math.trunc(lossGraceDays)) * DAY_MS,
  );
}

export function eligibleForPerformance(
  startedAt: Date,
  cutoff: Date,
  returnBps: number,
  lossGraceDays: number,
): boolean {
  if (startedAt > cutoff) return false;
  if (returnBps >= 0 || lossGraceDays <= 0) return true;
  return startedAt <= lossGraceCutoff(cutoff, lossGraceDays);
}

export function protectedFromLoss(
  startedAt: Date,
  cutoff: Date,
  lossGraceDays: number,
): boolean {
  return (
    lossGraceDays > 0 &&
    startedAt <= cutoff &&
    startedAt > lossGraceCutoff(cutoff, lossGraceDays)
  );
}
