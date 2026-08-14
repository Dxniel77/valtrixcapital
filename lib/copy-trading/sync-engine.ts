/**
 * Proportional P&L distribution for Copy Trading investors.
 * Ported from the audited mobile prototype (see docs/COPY_TRADING_SPEC.md §3).
 */

export const BPS_DENOMINATOR = 10_000n;

export type SyncInvestment = {
  id: string;
  principal: bigint;
  currentValue: bigint;
  realizedPnl: bigint;
};

export type SyncLedgerEntry = {
  investmentId: string;
  kind: "PNL";
  amount: bigint;
  balanceAfter: bigint;
};

export type SyncResult = {
  investments: SyncInvestment[];
  ledger: SyncLedgerEntry[];
  totalDelta: bigint;
};

export type SyncPerformanceFeeEntry = {
  investmentId: string;
  kind: "PERFORMANCE_FEE";
  /** Negative amount deducted from the investment. */
  amount: bigint;
  balanceAfter: bigint;
};

export type SyncResultWithPerformanceFee = {
  investments: SyncInvestment[];
  pnlLedger: SyncLedgerEntry[];
  feeLedger: SyncPerformanceFeeEntry[];
  grossTotalDelta: bigint;
  totalFee: bigint;
  /** Net change credited to copy investments after the profit-only fee. */
  totalDelta: bigint;
};

export function mulDivHalfEven(value: bigint, numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error("mulDivHalfEven: denominator must be non-zero");
  const product = value * numerator;
  const negative = product < 0n;
  const abs = negative ? -product : product;
  const quotient = abs / denominator;
  const remainder = abs % denominator;
  const twice = remainder * 2n;

  let rounded = quotient;
  if (twice > denominator) {
    rounded = quotient + 1n;
  } else if (twice === denominator && quotient % 2n === 1n) {
    rounded = quotient + 1n;
  }

  return negative ? -rounded : rounded;
}

export function roiBps(investment: Pick<SyncInvestment, "principal" | "currentValue">): bigint {
  if (investment.principal <= 0n) return 0n;
  return ((investment.currentValue - investment.principal) * BPS_DENOMINATOR) / investment.principal;
}

export function applyPerformance(
  investments: readonly SyncInvestment[],
  returnBps: number,
): SyncResult {
  if (!Number.isInteger(returnBps)) {
    throw new Error("applyPerformance: returnBps must be an integer number of basis points");
  }
  const bps = BigInt(returnBps);

  const nextInvestments: SyncInvestment[] = [];
  const ledger: SyncLedgerEntry[] = [];
  let totalDelta = 0n;

  for (const inv of investments) {
    let delta = mulDivHalfEven(inv.currentValue, bps, BPS_DENOMINATOR);
    let balanceAfter = inv.currentValue + delta;

    if (balanceAfter < 0n) {
      delta = -inv.currentValue;
      balanceAfter = 0n;
    }

    nextInvestments.push({
      ...inv,
      currentValue: balanceAfter,
      realizedPnl: inv.realizedPnl + delta,
    });
    ledger.push({ investmentId: inv.id, kind: "PNL", amount: delta, balanceAfter });
    totalDelta += delta;
  }

  return { investments: nextInvestments, ledger, totalDelta };
}

/**
 * Applies gross trader performance and deducts a fee only from positive P&L.
 * Losses never generate a fee. The two ledger streams make gross return and
 * company revenue independently auditable.
 */
export function applyPerformanceWithFee(
  investments: readonly SyncInvestment[],
  returnBps: number,
  performanceFeeBps: number,
): SyncResultWithPerformanceFee {
  if (
    !Number.isInteger(performanceFeeBps) ||
    performanceFeeBps < 0 ||
    performanceFeeBps > 10_000
  ) {
    throw new Error(
      "applyPerformanceWithFee: performanceFeeBps must be between 0 and 10000",
    );
  }

  const gross = applyPerformance(investments, returnBps);
  const feeLedger: SyncPerformanceFeeEntry[] = [];
  let totalFee = 0n;

  const nextInvestments = gross.investments.map((investment, index) => {
    const pnl = gross.ledger[index]!;
    const fee =
      pnl.amount > 0n
        ? (pnl.amount * BigInt(performanceFeeBps)) / BPS_DENOMINATOR
        : 0n;
    if (fee <= 0n) return investment;

    const balanceAfter = investment.currentValue - fee;
    totalFee += fee;
    feeLedger.push({
      investmentId: investment.id,
      kind: "PERFORMANCE_FEE",
      amount: -fee,
      balanceAfter,
    });
    return {
      ...investment,
      currentValue: balanceAfter,
      realizedPnl: investment.realizedPnl - fee,
    };
  });

  return {
    investments: nextInvestments,
    pnlLedger: gross.ledger,
    feeLedger,
    grossTotalDelta: gross.totalDelta,
    totalFee,
    totalDelta: gross.totalDelta - totalFee,
  };
}
