import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

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

/** Resolves a referral code to a user id (DB code or VX + wallet suffix share links). */
export async function resolveReferrerIdByCode(
  code: string,
): Promise<string | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const byCode = await prisma.user.findUnique({
    where: { referralCode: normalized },
    select: { id: true },
  });
  if (byCode) return byCode.id;

  // Share links use wallet-derived codes: VX + last 6 hex chars of address.
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
