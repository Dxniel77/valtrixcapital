import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import {
  isReferralLinkEligibleFromMicro,
  type ReferralLinkIneligibleReason,
} from "@/lib/referrals/link-eligibility";

export function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function generateUniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 8; i += 1) {
    const code = generateReferralCode();
    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  return `${generateReferralCode()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

const referrerSelect = {
  id: true,
  isActive: true,
  lockedCapital: true,
} as const;

function eligibleReferrerId(
  user: { id: string; isActive: boolean; lockedCapital: bigint } | null,
): string | null {
  if (!user) return null;
  return isReferralLinkEligibleFromMicro(user.isActive, user.lockedCapital)
    ? user.id
    : null;
}

/** Links a new user to a sponsor by code (does not require sponsor eligibility). */
export async function resolveReferrerIdForLinking(
  code: string,
): Promise<string | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const byCode = await prisma.user.findUnique({
    where: { referralCode: normalized },
    select: { id: true },
  });
  if (byCode) return byCode.id;

  if (/^VX[0-9A-F]{6}$/.test(normalized)) {
    const suffix = normalized.slice(2).toLowerCase();
    const byWallet = await prisma.user.findFirst({
      where: { walletAddress: { endsWith: suffix } },
      select: { id: true },
    });
    return byWallet?.id ?? null;
  }

  return null;
}

/** Resolves a referral code to a user id (DB code or VX + wallet suffix share links). */
export async function resolveReferrerIdByCode(
  code: string,
): Promise<string | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const byCode = await prisma.user.findUnique({
    where: { referralCode: normalized },
    select: referrerSelect,
  });
  if (byCode) return eligibleReferrerId(byCode);

  if (/^VX[0-9A-F]{6}$/.test(normalized)) {
    const suffix = normalized.slice(2).toLowerCase();
    const byWallet = await prisma.user.findFirst({
      where: { walletAddress: { endsWith: suffix } },
      select: referrerSelect,
    });
    return eligibleReferrerId(byWallet);
  }

  return null;
}

export type ReferralCodeStatus =
  | { eligible: true; referrerId: string }
  | { eligible: false; reason: ReferralLinkIneligibleReason };

function statusFromUser(
  user: { id: string; isActive: boolean; lockedCapital: bigint } | null,
): ReferralCodeStatus {
  if (!user) return { eligible: false, reason: "not_found" };
  if (!user.isActive) return { eligible: false, reason: "inactive" };
  if (!isReferralLinkEligibleFromMicro(user.isActive, user.lockedCapital)) {
    return { eligible: false, reason: "no_capital" };
  }
  return { eligible: true, referrerId: user.id };
}

/** Checks whether a referral code can sponsor new sign-ups. */
export async function validateReferralCode(
  code: string,
): Promise<ReferralCodeStatus> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { eligible: false, reason: "not_found" };

  const byCode = await prisma.user.findUnique({
    where: { referralCode: normalized },
    select: referrerSelect,
  });
  if (byCode) return statusFromUser(byCode);

  if (/^VX[0-9A-F]{6}$/.test(normalized)) {
    const suffix = normalized.slice(2).toLowerCase();
    const byWallet = await prisma.user.findFirst({
      where: { walletAddress: { endsWith: suffix } },
      select: referrerSelect,
    });
    return statusFromUser(byWallet);
  }

  return { eligible: false, reason: "not_found" };
}
