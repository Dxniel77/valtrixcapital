import { prisma } from "@/lib/db";
import { evaluateWithdrawalEligibility } from "@/lib/admin/withdrawal-eligibility";
import { parseWithdrawalRuleJson } from "@/lib/admin/grant-rules";
import { sumRealUnlockVolumeForUsers } from "@/lib/services/sponsored-capital";
import { fromMicro } from "@/lib/utils";

type UnlockVolumeMicro = {
  unlockDirectVolume: bigint;
  unlockLevel1Volume: bigint;
  unlockLevel2Volume: bigint;
};

async function sumConfirmedDeposits(userIds: string[]): Promise<bigint> {
  return sumRealUnlockVolumeForUsers(userIds);
}

/** Recomputes unlock counters for sponsored uplines after a real deposit confirms. */
export async function refreshUnlockVolumesForDepositUpline(
  depositorUserId: string,
): Promise<void> {
  let currentId: string | null = depositorUserId;

  for (let hop = 0; hop < 2 && currentId; hop += 1) {
    const row: { referrerId: string | null } | null =
      await prisma.user.findUnique({
        where: { id: currentId },
        select: { referrerId: true },
      });
    const referrerId: string | null = row?.referrerId ?? null;
    if (!referrerId) break;

    const sponsor = await prisma.user.findUnique({
      where: { id: referrerId },
      select: { accountGranted: true },
    });
    if (sponsor?.accountGranted) {
      await resolveUnlockVolumes(referrerId);
    }

    currentId = referrerId;
  }
}

/** Derives unlock metrics from real capital in the referral tree (not company grants). */
export async function computeUnlockVolumesFromNetwork(
  userId: string,
): Promise<UnlockVolumeMicro> {
  const l1Users = await prisma.user.findMany({
    where: { referrerId: userId },
    select: { id: true },
  });
  const l1Ids = l1Users.map((u) => u.id);

  const l2Users =
    l1Ids.length > 0
      ? await prisma.user.findMany({
          where: { referrerId: { in: l1Ids } },
          select: { id: true },
        })
      : [];
  const l2Ids = l2Users.map((u) => u.id);

  const [l1Sum, l2Sum] = await Promise.all([
    sumConfirmedDeposits(l1Ids),
    sumConfirmedDeposits(l2Ids),
  ]);

  return {
    unlockDirectVolume: l1Sum,
    unlockLevel1Volume: l1Sum,
    unlockLevel2Volume: l2Sum,
  };
}

function maxVolume(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/** Merges stored unlock counters with live network deposit totals and persists gaps. */
export async function resolveUnlockVolumes(
  userId: string,
): Promise<{ directSalesVolume: number; levelVolumes: number[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountGranted: true,
      unlockDirectVolume: true,
      unlockLevel1Volume: true,
      unlockLevel2Volume: true,
    },
  });
  if (!user) {
    return { directSalesVolume: 0, levelVolumes: [0, 0, 0, 0, 0, 0, 0, 0] };
  }

  const stored: UnlockVolumeMicro = {
    unlockDirectVolume: user.unlockDirectVolume,
    unlockLevel1Volume: user.unlockLevel1Volume,
    unlockLevel2Volume: user.unlockLevel2Volume,
  };

  const computed = user.accountGranted
    ? await computeUnlockVolumesFromNetwork(userId)
    : stored;

  const merged: UnlockVolumeMicro = {
    unlockDirectVolume: maxVolume(
      stored.unlockDirectVolume,
      computed.unlockDirectVolume,
    ),
    unlockLevel1Volume: maxVolume(
      stored.unlockLevel1Volume,
      computed.unlockLevel1Volume,
    ),
    unlockLevel2Volume: maxVolume(
      stored.unlockLevel2Volume,
      computed.unlockLevel2Volume,
    ),
  };

  const needsPersist =
    merged.unlockDirectVolume !== stored.unlockDirectVolume ||
    merged.unlockLevel1Volume !== stored.unlockLevel1Volume ||
    merged.unlockLevel2Volume !== stored.unlockLevel2Volume;

  if (needsPersist) {
    await prisma.user.update({
      where: { id: userId },
      data: merged,
    });
  }

  if (user.accountGranted) {
    await evaluateAndPersistWithdrawalUnlock(userId);
  }

  return unlockVolumesFromUser(merged);
}

/** Rebuilds unlock counters for every sponsored account from deposit history. */
export async function backfillUnlockVolumes(): Promise<number> {
  const sponsored = await prisma.user.findMany({
    where: { accountGranted: true },
    select: { id: true },
  });

  for (const row of sponsored) {
    await resolveUnlockVolumes(row.id);
  }

  return sponsored.length;
}

/** Credit real-deposit volume to uplines for withdrawal unlock rules. */
export async function propagateRealDepositVolume(
  depositorUserId: string,
  amountMicro: bigint,
): Promise<void> {
  if (amountMicro <= 0n) return;

  let currentId: string | null = depositorUserId;
  let hop = 0;

  while (currentId && hop < 2) {
    const userRow: { referrerId: string | null } | null =
      await prisma.user.findUnique({
        where: { id: currentId },
        select: { referrerId: true },
      });
    const referrerId: string | null = userRow?.referrerId ?? null;
    if (!referrerId) break;

    hop += 1;
    if (hop === 1) {
      await prisma.user.update({
        where: { id: referrerId },
        data: {
          unlockDirectVolume: { increment: amountMicro },
          unlockLevel1Volume: { increment: amountMicro },
        },
      });
    } else if (hop === 2) {
      await prisma.user.update({
        where: { id: referrerId },
        data: {
          unlockLevel2Volume: { increment: amountMicro },
        },
      });
    }

    await evaluateAndPersistWithdrawalUnlock(referrerId);
    currentId = referrerId;
  }

  await refreshUnlockVolumesForDepositUpline(depositorUserId);
}

/** Auto-unlock withdrawals when sponsored user meets real-volume rules. */
export async function evaluateAndPersistWithdrawalUnlock(
  userId: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.accountGranted || user.withdrawalUnlocked) {
    return user?.withdrawalUnlocked ?? false;
  }

  const rule = parseWithdrawalRuleJson(user.withdrawalRule);
  const levelVolumes = [
    fromMicro(user.unlockLevel1Volume),
    fromMicro(user.unlockLevel2Volume),
    0,
    0,
    0,
    0,
    0,
    0,
  ];

  const result = evaluateWithdrawalEligibility({
    accountGranted: true,
    withdrawalUnlocked: false,
    withdrawalRule: rule,
    directSalesVolume: fromMicro(user.unlockDirectVolume),
    levelVolumes,
  });

  if (!result.eligible) return false;

  await prisma.user.update({
    where: { id: userId },
    data: { withdrawalUnlocked: true },
  });
  return true;
}

export function unlockVolumesFromUser(user: UnlockVolumeMicro): {
  directSalesVolume: number;
  levelVolumes: number[];
} {
  return {
    directSalesVolume: fromMicro(user.unlockDirectVolume),
    levelVolumes: [
      fromMicro(user.unlockLevel1Volume),
      fromMicro(user.unlockLevel2Volume),
      0,
      0,
      0,
      0,
      0,
      0,
    ],
  };
}
