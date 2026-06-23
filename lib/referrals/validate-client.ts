import type { ReferralLinkIneligibleReason } from "@/lib/referrals/link-eligibility";

export type ReferralValidationStatus =
  | { eligible: true }
  | { eligible: false; reason: ReferralLinkIneligibleReason };

export async function validateReferralCode(
  code: string,
): Promise<ReferralValidationStatus> {
  const normalized = code.trim();
  if (!normalized) return { eligible: false, reason: "not_found" };

  try {
    const res = await fetch(
      `/api/referrals/validate?code=${encodeURIComponent(normalized)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { eligible: false, reason: "not_found" };
    return (await res.json()) as ReferralValidationStatus;
  } catch {
    return { eligible: false, reason: "not_found" };
  }
}
