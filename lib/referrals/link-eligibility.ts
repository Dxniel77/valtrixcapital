import { MIN_ACTIVE_CAPITAL_USDT } from "@/lib/referrals/constants";
import { toMicro } from "@/lib/utils";

export type ReferralLinkIneligibleReason =
  | "not_found"
  | "inactive"
  | "no_capital";

const MIN_CAPITAL_MICRO = toMicro(MIN_ACTIVE_CAPITAL_USDT);

export function hasMinReferralCapital(activeCapitalUsdt: number): boolean {
  return (
    Number.isFinite(activeCapitalUsdt) &&
    activeCapitalUsdt >= MIN_ACTIVE_CAPITAL_USDT
  );
}

export function isReferralLinkEligible(input: {
  isActive: boolean;
  activeCapitalUsdt: number;
}): boolean {
  return input.isActive && hasMinReferralCapital(input.activeCapitalUsdt);
}

export function isReferralLinkEligibleFromMicro(
  isActive: boolean,
  lockedCapitalMicro: bigint,
): boolean {
  return isActive && lockedCapitalMicro >= MIN_CAPITAL_MICRO;
}

export function referralLinkIneligibleReason(input: {
  isActive: boolean;
  activeCapitalUsdt: number;
}): ReferralLinkIneligibleReason | null {
  if (!input.isActive) return "inactive";
  if (!hasMinReferralCapital(input.activeCapitalUsdt)) return "no_capital";
  return null;
}
