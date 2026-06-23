/** Eight-level commission rates (basis points) — matches marketing defaults. */
export const REFERRAL_LEVELS = 8;

export const COMMISSION_RATES_BPS: readonly number[] = [
  2000, 1000, 1000, 1000, 500, 500, 500, 500,
];

export const COMMISSION_RATES_PCT = COMMISSION_RATES_BPS.map((b) => b / 100);

const LEGACY_COMMISSION_RATES_BPS = [700, 300, 200, 100, 100, 50, 50] as const;

/** Coerces a single slot to basis points (handles 0, percent integers, 10× scale, legacy). */
function coerceSlotRateBps(raw: number | undefined, index: number): number {
  const expected = COMMISSION_RATES_BPS[index] ?? 0;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) {
    return expected;
  }

  const v = Math.round(raw);
  if (v === expected) return v;

  // Whole-number percent (20 / 10 / 5) saved instead of bps (2000 / 1000 / 500).
  if (v <= 100 && v * 100 === expected) return expected;
  // bps off by 10× (200 / 100 / 50 instead of 2000 / 1000 / 500).
  if (v * 10 === expected) return expected;
  // Legacy seven-level deploy defaults.
  const legacy = LEGACY_COMMISSION_RATES_BPS[index];
  if (legacy !== undefined && v === legacy) return expected;

  return v;
}

export function commissionRateNeedsNormalization(rates: number[]): boolean {
  const normalized = normalizeCommissionRatesBps(rates);
  if (rates.length !== normalized.length) return true;
  return normalized.some((v, i) => v !== (rates[i] ?? 0));
}

/** Always returns exactly eight bps rates used for upline payouts. */
export function normalizeCommissionRatesBps(rates: number[]): number[] {
  if (
    rates.length === COMMISSION_RATES_BPS.length &&
    rates.every((v, i) => v === COMMISSION_RATES_BPS[i])
  ) {
    return [...COMMISSION_RATES_BPS];
  }

  // Entire array stored as whole-number percents (20 = 20%).
  if (
    rates.length > 0 &&
    rates.length <= REFERRAL_LEVELS &&
    rates.every((v) => v > 0 && v <= 100)
  ) {
    return Array.from({ length: REFERRAL_LEVELS }, (_, i) =>
      coerceSlotRateBps(i < rates.length ? rates[i]! * 100 : undefined, i),
    );
  }

  return Array.from({ length: REFERRAL_LEVELS }, (_, i) =>
    coerceSlotRateBps(i < rates.length ? rates[i] : undefined, i),
  );
}

/** Minimum active capital (USDT) for a downline to count as "active". */
export const MIN_ACTIVE_CAPITAL_USDT = 15;
