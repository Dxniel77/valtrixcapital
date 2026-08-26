export const DEFAULT_OPEN_FEE_BPS = 5;
/** 1% of capital when starting to copy a trader. */
export const DEFAULT_INVEST_FEE_BPS = 100;
/** 0% when leaving a trader back to copy cash. */
export const DEFAULT_WITHDRAW_FEE_BPS = 0;
/** 0.03% when sending copy cash to an on-chain wallet. */
export const DEFAULT_COPY_CASH_WALLET_FEE_BPS = 3;

/** 0.05% of the copier's capital when a live operation opens (not × leverage). */
export function platformOpenFeeMicro(
  capitalMicro: bigint,
  openFeeBps = DEFAULT_OPEN_FEE_BPS,
): bigint {
  if (capitalMicro <= 0n) return 0n;
  const bps = Math.max(0, Math.trunc(openFeeBps));
  if (bps <= 0) return 0n;
  return (capitalMicro * BigInt(bps)) / 10_000n;
}

export function platformOpenFeeNote(operationId: string): string {
  return `platform-open:${operationId}`;
}
