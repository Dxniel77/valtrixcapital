export function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function utcDayStart(now: Date): Date {
  return new Date(`${utcDayKey(now)}T00:00:00.000Z`);
}

export function utcNextDayStart(now: Date): Date {
  const start = utcDayStart(now);
  start.setUTCDate(start.getUTCDate() + 1);
  return start;
}
