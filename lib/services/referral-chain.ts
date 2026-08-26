import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { REFERRAL_LEVELS } from "@/lib/referrals/constants";

type ReferrerLookup = {
  user: {
    findUnique: Prisma.TransactionClient["user"]["findUnique"];
  };
};

/** Walks `User.referrerId` up to `maxLevels` ancestors (L1 = direct sponsor). */
export async function resolveUplineChain(
  startUserId: string,
  maxLevels = REFERRAL_LEVELS,
  db: ReferrerLookup = prisma,
): Promise<string[]> {
  const chain: string[] = [];
  let currentId: string | null = startUserId;

  for (let hop = 0; hop < maxLevels && currentId; hop += 1) {
    const row: { referrerId: string | null } | null =
      await db.user.findUnique({
        where: { id: currentId },
        select: { referrerId: true },
      });
    const referrerId: string | null = row?.referrerId ?? null;
    if (!referrerId) break;
    chain.push(referrerId);
    currentId = referrerId;
  }

  return chain;
}

/** Materializes the upline chain in `Referral` rows (one row per hop). */
export async function syncUserReferralChain(userId: string): Promise<void> {
  const uplines = await resolveUplineChain(userId, REFERRAL_LEVELS);

  await prisma.$transaction(async (tx) => {
    await tx.referral.deleteMany({ where: { userId } });
    for (let level = 0; level < uplines.length; level += 1) {
      await tx.referral.create({
        data: {
          userId,
          uplineId: uplines[level]!,
          level: level + 1,
        },
      });
    }
  });
}

/** Rebuilds referral-chain rows for every user (safe to rerun). */
export async function backfillReferralChains(): Promise<number> {
  const users = await prisma.user.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let synced = 0;
  for (const user of users) {
    await syncUserReferralChain(user.id);
    synced += 1;
  }
  return synced;
}
