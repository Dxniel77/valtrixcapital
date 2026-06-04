/** Eight-level commission rates (basis points) — matches marketing defaults. */
export const REFERRAL_LEVELS = 8;

export const COMMISSION_RATES_BPS: readonly number[] = [
  2000, 1000, 1000, 1000, 500, 500, 500, 500,
];

export const COMMISSION_RATES_PCT = COMMISSION_RATES_BPS.map((b) => b / 100);

/** Minimum active capital (USDT) for a downline to count as "active". */
export const MIN_ACTIVE_CAPITAL_USDT = 15;
