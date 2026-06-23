import { prisma } from "@/lib/db";

async function repairDepositStake(deposit: {
  id: string;
  userId: string;
  amount: bigint;
  network: string;
  stake: { id: string; source: string; depositId: string | null } | null;
}): Promise<boolean> {
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
 * Links confirmed on-chain deposits to ON_CHAIN stakes so real-capital
 * detection and upline commissions stay consistent after legacy data drift.
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
