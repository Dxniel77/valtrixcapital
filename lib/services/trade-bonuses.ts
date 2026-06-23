import { prisma } from "@/lib/db";
import { getPlatformConfig } from "@/lib/services/config";
import { distributeReferralCommissions } from "@/lib/services/commissions";

const PAYOUT_CAP_MULTIPLIER = 2;

function applyEarningsCredit(
  totalEarned: bigint,
  payoutCap: bigint,
  amountMicro: bigint,
): bigint {
  if (payoutCap <= 0n) return 0n;
  const room = payoutCap - totalEarned;
  if (room <= 0n) return 0n;
  return amountMicro > room ? room : amountMicro;
}

/**
 * Replays stake deposits vs win resolve times so each win bonus uses
 * capital active at resolve (0.1% × capital then), not today's total.
 */
export async function reconcileUserWinBonuses(userId: string): Promise<void> {
  const config = await getPlatformConfig();
  const bonusBps = BigInt(config.bonusPerWinBps);

  const [user, stakes, wins] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.stake.findMany({
      where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } },
      orderBy: { startedAt: "asc" },
    }),
    prisma.trade.findMany({
      where: { userId, result: "WIN", resolvedAt: { not: null } },
      orderBy: { resolvedAt: "asc" },
    }),
  ]);

  if (wins.length === 0) return;

  const stakeEvents = stakes
    .map((stake) => ({
      at: stake.startedAt,
      amount: stake.amount,
    }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  let stakeIdx = 0;
  let capital = 0n;
  let operationalTotal = 0n;
  const tradeUpdates: {
    id: string;
    capitalSnapshotAtWin: bigint;
    bonusCredited: bigint;
  }[] = [];

  for (const win of wins) {
    const at = win.resolvedAt!;
    while (stakeIdx < stakeEvents.length && stakeEvents[stakeIdx].at <= at) {
      capital += stakeEvents[stakeIdx].amount;
      stakeIdx += 1;
    }

    const rawBonus = capital > 0n ? (capital * bonusBps) / 10_000n : 0n;
    const payoutCap =
      user.payoutCap > 0n
        ? user.payoutCap
        : capital * BigInt(PAYOUT_CAP_MULTIPLIER);
    const applied = applyEarningsCredit(operationalTotal, payoutCap, rawBonus);

    tradeUpdates.push({
      id: win.id,
      capitalSnapshotAtWin: capital,
      bonusCredited: applied,
    });
    operationalTotal += applied;
  }

  const passiveTotal = await prisma.dailyYieldRecord.aggregate({
    where: { userId },
    _sum: { creditedAmount: true },
  });
  const networkTotal = await prisma.commission.aggregate({
    where: { beneficiaryId: userId },
    _sum: { amount: true },
  });

  const passive = passiveTotal._sum.creditedAmount ?? 0n;
  const network = networkTotal._sum?.amount ?? 0n;
  const correctTotalEarned = operationalTotal + passive + network;

  const activeCapital = stakes
    .filter((s) => s.status === "ACTIVE")
    .reduce((acc, s) => acc + s.amount, 0n);
  const payoutCap =
    user.payoutCap > 0n
      ? user.payoutCap
      : activeCapital * BigInt(PAYOUT_CAP_MULTIPLIER);
  const cappedTotal =
    payoutCap > 0n && correctTotalEarned > payoutCap
      ? payoutCap
      : correctTotalEarned;

  const needsUserUpdate = user.totalEarned !== cappedTotal;
  const needsTradeUpdate = tradeUpdates.some(
    (row, i) =>
      wins[i].bonusCredited !== row.bonusCredited ||
      wins[i].capitalSnapshotAtWin !== row.capitalSnapshotAtWin,
  );

  if (!needsUserUpdate && !needsTradeUpdate) return;

  await prisma.$transaction(async (tx) => {
    for (const row of tradeUpdates) {
      await tx.trade.update({
        where: { id: row.id },
        data: {
          capitalSnapshotAtWin: row.capitalSnapshotAtWin,
          bonusCredited: row.bonusCredited,
        },
      });
    }

    if (needsUserUpdate) {
      await tx.user.update({
        where: { id: userId },
        data: { totalEarned: cappedTotal },
      });
    }
  });

  for (let i = 0; i < wins.length; i += 1) {
    const delta = tradeUpdates[i].bonusCredited - wins[i].bonusCredited;
    if (delta <= 0n) continue;
    await distributeReferralCommissions({
      sourceUserId: userId,
      amountMicro: delta,
      ratesBps: config.commissionRatesBps,
      sourceTradeId: wins[i].id,
    });
  }
}
