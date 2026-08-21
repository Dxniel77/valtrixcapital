import { prisma } from "@/lib/db";
import { refreshUserPayoutCap } from "@/lib/services/stakes";

type RepairDeposit = {
  id: string;
  userId: string;
  amount: bigint;
  network: string;
  purpose: string;
  stake: {
    id: string;
    source: string;
    status: string;
    amount: bigint;
    depositId: string | null;
  } | null;
};

/**
 * COPY deposits credit copyCashBalance only. A previous repair treated them as
 * staking deposits and created ON_CHAIN stakes + lockedCapital — double pay.
 * Undo that: cancel the mistaken stake and remove its amount from locked capital.
 */
async function unlinkMistakenCopyStake(deposit: RepairDeposit): Promise<boolean> {
  const linked =
    deposit.stake ??
    (await prisma.stake.findFirst({
      where: { depositId: deposit.id },
    }));
  if (!linked) return false;
  if (linked.status === "CANCELED") return false;

  await prisma.$transaction(async (tx) => {
    await tx.stake.update({
      where: { id: linked.id },
      data: { status: "CANCELED", depositId: null },
    });

    const user = await tx.user.findUnique({
      where: { id: deposit.userId },
      select: { lockedCapital: true },
    });
    const locked = user?.lockedCapital ?? 0n;
    const nextLocked = locked > linked.amount ? locked - linked.amount : 0n;
    if (nextLocked !== locked) {
      await tx.user.update({
        where: { id: deposit.userId },
        data: { lockedCapital: nextLocked },
      });
    }
  });

  await refreshUserPayoutCap(deposit.userId);
  return true;
}

async function repairDepositStake(deposit: RepairDeposit): Promise<boolean> {
  if (deposit.purpose === "COPY") {
    return unlinkMistakenCopyStake(deposit);
  }

  if (
    deposit.stake?.source === "ON_CHAIN" &&
    deposit.stake.depositId === deposit.id
  ) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    const linked = await tx.stake.findFirst({
      where: { depositId: deposit.id },
      select: { id: true, source: true },
    });
    if (linked) {
      if (linked.source !== "ON_CHAIN") {
        await tx.stake.update({
          where: { id: linked.id },
          data: { source: "ON_CHAIN" },
        });
      }
      return;
    }

    if (deposit.stake) {
      if (deposit.stake.source === "COMPANY_SPONSORED") {
        await tx.stake.create({
          data: {
            userId: deposit.userId,
            amount: deposit.amount,
            network: deposit.network as "BSC" | "POLYGON",
            depositId: deposit.id,
            status: "ACTIVE",
            source: "ON_CHAIN",
          },
        });

        const user = await tx.user.findUnique({
          where: { id: deposit.userId },
          select: { lockedCapital: true },
        });
        const stakeTotal = await tx.stake.aggregate({
          where: { userId: deposit.userId, status: "ACTIVE" },
          _sum: { amount: true },
        });
        const activeTotal = stakeTotal._sum.amount ?? 0n;
        const locked = user?.lockedCapital ?? 0n;
        if (activeTotal > locked) {
          await tx.user.update({
            where: { id: deposit.userId },
            data: { lockedCapital: activeTotal },
          });
        }
        return;
      }

      await tx.stake.update({
        where: { id: deposit.stake.id },
        data: {
          source: "ON_CHAIN",
          depositId: deposit.id,
        },
      });
      return;
    }

    await tx.stake.create({
      data: {
        userId: deposit.userId,
        amount: deposit.amount,
        network: deposit.network as "BSC" | "POLYGON",
        depositId: deposit.id,
        status: "ACTIVE",
        source: "ON_CHAIN",
      },
    });

    const user = await tx.user.findUnique({
      where: { id: deposit.userId },
      select: { lockedCapital: true },
    });
    const locked = user?.lockedCapital ?? 0n;
    if (locked < deposit.amount) {
      await tx.user.update({
        where: { id: deposit.userId },
        data: { lockedCapital: { increment: deposit.amount } },
      });
    }
  });

  return true;
}

/**
 * Links confirmed STAKING deposits to ON_CHAIN stakes. Never stakes COPY
 * deposits — those credit copy cash only.
 */
export async function repairRealStakeSources(): Promise<number> {
  const deposits = await prisma.deposit.findMany({
    where: { status: "CONFIRMED" },
    include: { stake: true },
  });

  let repaired = 0;
  for (const deposit of deposits) {
    if (await repairDepositStake(deposit)) repaired += 1;
  }
  return repaired;
}

/** Repairs stake/deposit linkage for specific users (referral snapshot load). */
export async function repairRealStakeSourcesForUsers(
  userIds: string[],
): Promise<number> {
  if (userIds.length === 0) return 0;

  const deposits = await prisma.deposit.findMany({
    where: { userId: { in: userIds }, status: "CONFIRMED" },
    include: { stake: true },
  });

  let repaired = 0;
  for (const deposit of deposits) {
    if (await repairDepositStake(deposit)) repaired += 1;
  }
  return repaired;
}

/** Undo COPY deposits that were incorrectly turned into staked capital. */
export async function unlinkMistakenCopyStakesForUser(
  userId: string,
): Promise<number> {
  const deposits = await prisma.deposit.findMany({
    where: { userId, status: "CONFIRMED", purpose: "COPY" },
    include: { stake: true },
  });

  let repaired = 0;
  for (const deposit of deposits) {
    if (await unlinkMistakenCopyStake(deposit)) repaired += 1;
  }
  return repaired;
}
