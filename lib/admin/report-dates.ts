/** UTC date-range helpers for admin cash-flow reports (client + server). */

export function parseReportDateStart(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00.000Z`).getTime();
}

export function parseReportDateEnd(dateKey: string): number {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCHours(23, 59, 59, 999);
  return d.getTime();
}

export function toReportDateInput(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function defaultReportFromDate(): string {
  return toReportDateInput(Date.now() - 30 * 86_400_000);
}

export function defaultReportToDate(): string {
  return toReportDateInput(Date.now());
}

export function reportRangeFromMs(fromMs: number, toMs: number) {
  return {
    from: new Date(fromMs),
    to: new Date(toMs),
  };
}
