/** Company fee from a settlement — small bps, clamped to realistic cents range. */
export function computeSettlementFee(amountUsdt: number): number {
  const feeBps = 4 + Math.random() * 10; // 0.04% – 0.14%
  const raw = (amountUsdt * feeBps) / 10_000;
  const clamped = Math.min(Math.max(raw, 0.002), 3.5);
  return Math.round(clamped * 1000) / 1000;
}

/** Daily throughput multiplier — some UTC days earn more than others. */
export function dailyVolumeMultiplier(dayKey: string): number {
  let hash = 0;
  for (let i = 0; i < dayKey.length; i += 1) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) | 0;
  }
  const normalized = (Math.abs(hash) % 1000) / 1000;
  return 0.75 + normalized * 0.55; // 0.75 – 1.30
}
