export const COPY_NETWORK_LEVELS = 6;

/** Daniel standard: each trader charges 30% of copier profit. Editable per trader. */
export const DEFAULT_PERFORMANCE_FEE_BPS = 3000;

/** Daniel defaults: L1 30%, L2 15%, L3 10%, L4–L6 5% each (70% network / 30% company). */
export const DEFAULT_PERFORMANCE_FEE_NETWORK_BPS: readonly number[] = [
  3000, 1500, 1000, 500, 500, 500,
];

export function traderPerformanceFeeBps(value?: number | null): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_PERFORMANCE_FEE_BPS;
  return Math.min(10_000, Math.max(0, Math.trunc(value)));
}

export type NetworkFeePayout = {
  level: number;
  rateBps: number;
  amount: bigint;
};

export type NetworkFeeSplit = {
  payouts: NetworkFeePayout[];
  networkTotal: bigint;
  companyKept: bigint;
};

export function normalizePerformanceFeeNetworkBps(
  rates: readonly number[] | null | undefined,
): number[] {
  const next = Array.from({ length: COPY_NETWORK_LEVELS }, (_, index) => {
    const raw = rates?.[index];
    if (raw == null || !Number.isFinite(raw)) return 0;
    return Math.min(10_000, Math.max(0, Math.round(raw)));
  });
  const sum = next.reduce((total, value) => total + value, 0);
  if (sum <= 10_000) return next;
  return next.map((value) => Math.floor((value * 10_000) / sum));
}

export function performanceFeeNetworkBpsSum(rates: readonly number[]): number {
  return normalizePerformanceFeeNetworkBps(rates).reduce(
    (total, value) => total + value,
    0,
  );
}

export function splitPerformanceFeeNetwork(
  feeMicro: bigint,
  ratesBps: readonly number[],
  uplineCount: number,
): NetworkFeeSplit {
  if (feeMicro <= 0n) {
    return { payouts: [], networkTotal: 0n, companyKept: 0n };
  }

  const rates = normalizePerformanceFeeNetworkBps(ratesBps);
  const filled = Math.min(COPY_NETWORK_LEVELS, Math.max(0, Math.trunc(uplineCount)));
  const payouts: NetworkFeePayout[] = [];
  let networkTotal = 0n;

  for (let index = 0; index < filled; index += 1) {
    const rateBps = rates[index] ?? 0;
    if (rateBps <= 0) continue;
    const amount = (feeMicro * BigInt(rateBps)) / 10_000n;
    if (amount <= 0n) continue;
    payouts.push({ level: index + 1, rateBps, amount });
    networkTotal += amount;
  }

  const companyKept = feeMicro > networkTotal ? feeMicro - networkTotal : 0n;
  return { payouts, networkTotal, companyKept };
}

export type PerformanceFeeRetention = {
  expectedNetwork: bigint;
  unfilledRetained: bigint;
  companyShare: bigint;
};

/**
 * Breaks a Performance Fee into: full L1–L6 if every upline existed,
 * the slice kept because some levels were empty, and the configured company remainder.
 */
export function performanceFeeUnfilledRetention(
  feeMicro: bigint,
  ratesBps: readonly number[],
  paidLevels: Iterable<number>,
): PerformanceFeeRetention {
  if (feeMicro <= 0n) {
    return { expectedNetwork: 0n, unfilledRetained: 0n, companyShare: 0n };
  }

  const rates = normalizePerformanceFeeNetworkBps(ratesBps);
  const paid = new Set<number>();
  for (const raw of paidLevels) {
    const level = Math.trunc(raw);
    if (level >= 1 && level <= COPY_NETWORK_LEVELS) paid.add(level);
  }

  let expectedNetwork = 0n;
  let unfilledRetained = 0n;
  for (let index = 0; index < COPY_NETWORK_LEVELS; index += 1) {
    const expected = (feeMicro * BigInt(rates[index] ?? 0)) / 10_000n;
    expectedNetwork += expected;
    if (!paid.has(index + 1)) unfilledRetained += expected;
  }

  const companyShare =
    feeMicro > expectedNetwork ? feeMicro - expectedNetwork : 0n;
  return { expectedNetwork, unfilledRetained, companyShare };
}
