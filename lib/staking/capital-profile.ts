/** True when the user has real deposited capital (not company-sponsored only). */
export function hasRealDepositedCapital(input: {
  realCapital: number;
  capitalProfileSynced: boolean;
  accountGranted?: boolean;
}): boolean {
  if (!input.capitalProfileSynced) {
    if (input.accountGranted) return false;
    return true;
  }
  return input.realCapital > 0;
}

/** UI: weekly/daily earnings bar — any user with active capital; hidden only when inactive. */
export function showDailyEarningsBar(input: { hasActiveCapital: boolean }): boolean {
  return input.hasActiveCapital;
}
