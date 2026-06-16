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
