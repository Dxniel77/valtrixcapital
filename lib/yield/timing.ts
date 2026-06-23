const DAY_MS = 24 * 60 * 60 * 1000;

function readEnvMs(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Wait after deposit confirmation before passive yield accrues (default 24h). */
export function getPassiveYieldDelayMs(): number {
  return readEnvMs("PASSIVE_YIELD_DELAY_MS", DAY_MS);
}

/** Minimum time between passive yield credits (default 24h). Set to 600000 for 10-minute test cadence. */
export function getYieldAccrualIntervalMs(): number {
  const interval = readEnvMs("YIELD_ACCRUAL_INTERVAL_MS", DAY_MS);
  return interval > 0 ? interval : DAY_MS;
}

export function isSubDailyYieldAccrual(): boolean {
  return getYieldAccrualIntervalMs() < DAY_MS;
}

export { DAY_MS as YIELD_DAY_MS };
