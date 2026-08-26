/**
 * Copy trading is simulated. Copier gross P&L is funded by the company:
 * user profit is a company cost, user loss is a company gain.
 * Fees kept after the referral network offset that.
 */
export function companyCopyEconomicMicro(
  feesKeptMicro: bigint,
  copierGrossPnlMicro: bigint,
): bigint {
  return feesKeptMicro - copierGrossPnlMicro;
}
