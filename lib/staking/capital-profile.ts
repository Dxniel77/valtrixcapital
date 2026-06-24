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

/** Sponsored leaders accrue operational bonuses on company capital (visible, no upline share). */
export function canAccrueSponsoredOperational(input: {
  accountGranted: boolean;
  companyCapital: number;
  capitalProfileSynced: boolean;
}): boolean {
  if (!input.accountGranted) return false;
  if (!input.capitalProfileSynced) return input.companyCapital > 0;
  return input.companyCapital > 0;
}

export function canAccrueOperationalEarnings(input: {
  accountGranted: boolean;
  realCapital: number;
  companyCapital: number;
  capitalProfileSynced: boolean;
}): boolean {
  if (canAccrueSponsoredOperational(input)) return true;
  return hasRealDepositedCapital(input);
}
