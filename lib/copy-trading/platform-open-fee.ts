export const DEFAULT_OPEN_FEE_BPS = 5;

/** 0.05% of notional (capital × leverage) unless a different bps is configured. */
export function platformOpenFeeMicro(
  capitalMicro: bigint,
  leverage: number,
  openFeeBps = DEFAULT_OPEN_FEE_BPS,
): bigint {
  if (capitalMicro <= 0n) return 0n;
  const lev = Math.max(1, Math.trunc(leverage));
  const bps = Math.max(0, Math.trunc(openFeeBps));
  if (bps <= 0) return 0n;
  return (capitalMicro * BigInt(lev) * BigInt(bps)) / 10_000n;
}

export function platformOpenFeeNote(operationId: string): string {
  return `platform-open:${operationId}`;
}
