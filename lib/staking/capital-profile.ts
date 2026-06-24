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

/** UI: daily earnings bar — leaders with active capital, or any user with real deposit. */
export function showDailyEarningsBar(input: {
  realCapital: number;
  capitalProfileSynced: boolean;
  accountGranted?: boolean;
  hasActiveCapital: boolean;
}): boolean {
  if (!input.hasActiveCapital) return false;
  if (input.accountGranted) return true;
  if (!input.capitalProfileSynced) return true;
  return input.realCapital > 0;
}
