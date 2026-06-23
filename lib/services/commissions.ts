import { prisma } from "@/lib/db";
import {
  normalizeCommissionRatesBps,
  REFERRAL_LEVELS,
} from "@/lib/referrals/constants";
import { getPlatformConfig } from "@/lib/services/config";
import { resolveUplineChain } from "@/lib/services/referral-chain";
import { commissionableAmountMicro } from "@/lib/services/sponsored-capital";

function effectiveCommissionRates(ratesBps: number[]): number[] {
  return normalizeCommissionRatesBps(ratesBps);
}

async function creditCommissionDelta(input: {
  commissionId: string;
  beneficiaryId: string;
  rateBps: number;
  previousAmount: bigint;
  expectedAmount: bigint;
}): Promise<void> {
  const delta = input.expectedAmount - input.previousAmount;
  if (delta <= 0n) return;

  await prisma.$transaction(async (tx) => {
    await tx.commission.update({
      where: { id: input.commissionId },
      data: {
        rateBps: input.rateBps,
        amount: input.expectedAmount,
      },
    });
    await tx.user.update({
      where: { id: input.beneficiaryId },
      data: {
        earningsBalance: { increment: delta },
        totalEarned: { increment: delta },
      },
    });
  });
}

/** Pays upline referral commissions from a downline earnings credit. */
export async function distributeReferralCommissions(input: {
  sourceUserId: string;
  amountMicro: bigint;
  ratesBps: number[];
  sourceYieldId?: string;
  sourceTradeId?: string;
  /** Precomputed when stake completion would zero out active capital mid-flow. */
  payableMicro?: bigint;
}): Promise<void> {
  if (input.amountMicro <= 0n) return;

  const payable =
    input.payableMicro ??
    (await commissionableAmountMicro(input.sourceUserId, input.amountMicro));
  if (payable <= 0n) return;

  const rates = effectiveCommissionRates(input.ratesBps);
  const uplines = await resolveUplineChain(input.sourceUserId, REFERRAL_LEVELS);

  for (let level = 1; level <= uplines.length && level <= REFERRAL_LEVELS; level += 1) {
    const referrerId = uplines[level - 1]!;
    const rateBps = rates[level - 1] ?? 0;
    if (rateBps <= 0) continue;

    const amount = (payable * BigInt(rateBps)) / 10_000n;
    if (amount <= 0n) continue;

    const existingWhere = input.sourceYieldId
      ? {
          beneficiaryId: referrerId,
          sourceUserId: input.sourceUserId,
          sourceYieldId: input.sourceYieldId,
          level,
        }
      : {
          beneficiaryId: referrerId,
          sourceUserId: input.sourceUserId,
          sourceTradeId: input.sourceTradeId,
          level,
        };

    const existing = await prisma.commission.findFirst({
      where: existingWhere,
      select: { id: true, rateBps: true, amount: true },
    });

    if (existing) {
      if (existing.rateBps === rateBps && existing.amount >= amount) continue;
      await creditCommissionDelta({
        commissionId: existing.id,
        beneficiaryId: referrerId,
        rateBps,
        previousAmount: existing.amount,
        expectedAmount: amount,
      });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.commission.create({
        data: {
          beneficiaryId: referrerId,
          sourceUserId: input.sourceUserId,
          level,
          rateBps,
          amount,
          sourceYieldId: input.sourceYieldId ?? null,
          sourceTradeId: input.sourceTradeId ?? null,
        },
      });
      await tx.user.update({
        where: { id: referrerId },
        data: {
          earningsBalance: { increment: amount },
          totalEarned: { increment: amount },
        },
      });
    });
  }
}

/** Replays commissions for earnings credits that never paid upline (safe to rerun). */
export async function backfillCommissionsForUserIds(
  userIds: string[],
): Promise<number> {
  if (userIds.length === 0) return 0;

  const config = await getPlatformConfig();
  let backfilled = 0;

  const [trades, yields] = await Promise.all([
    prisma.trade.findMany({
      where: {
        userId: { in: userIds },
        result: "WIN",
        bonusCredited: { gt: 0n },
      },
      select: { id: true, userId: true, bonusCredited: true },
    }),
    prisma.dailyYieldRecord.findMany({
      where: { userId: { in: userIds }, creditedAmount: { gt: 0n } },
      select: { id: true, userId: true, creditedAmount: true },
    }),
  ]);

  for (const row of trades) {
    const payable = await commissionableAmountMicro(
      row.userId,
      row.bonusCredited,
    );
    if (payable <= 0n) continue;

    await distributeReferralCommissions({
      sourceUserId: row.userId,
      amountMicro: row.bonusCredited,
      ratesBps: config.commissionRatesBps,
      sourceTradeId: row.id,
      payableMicro: payable,
    });
    backfilled += 1;
  }

  for (const row of yields) {
    const payable = await commissionableAmountMicro(
      row.userId,
      row.creditedAmount,
    );
    if (payable <= 0n) continue;

    await distributeReferralCommissions({
      sourceUserId: row.userId,
      amountMicro: row.creditedAmount,
      ratesBps: config.commissionRatesBps,
      sourceYieldId: row.id,
      payableMicro: payable,
    });
    backfilled += 1;
  }

  return backfilled;
}

/** Replays commissions for earnings credits that never paid upline (safe to rerun). */
export async function backfillMissedReferralCommissions(): Promise<{
  yieldsBackfilled: number;
  tradesBackfilled: number;
}> {
  const config = await getPlatformConfig();
  let yieldsBackfilled = 0;
  let tradesBackfilled = 0;

  const yieldRows = await prisma.dailyYieldRecord.findMany({
    where: { creditedAmount: { gt: 0n } },
    select: { id: true, userId: true, creditedAmount: true },
  });

  for (const row of yieldRows) {
    const payable = await commissionableAmountMicro(
      row.userId,
      row.creditedAmount,
    );
    if (payable <= 0n) continue;

    await distributeReferralCommissions({
      sourceUserId: row.userId,
      amountMicro: row.creditedAmount,
      ratesBps: config.commissionRatesBps,
      sourceYieldId: row.id,
      payableMicro: payable,
    });
    yieldsBackfilled += 1;
  }

  const tradeRows = await prisma.trade.findMany({
    where: { result: "WIN", bonusCredited: { gt: 0n } },
    select: { id: true, userId: true, bonusCredited: true },
  });

  for (const row of tradeRows) {
    const payable = await commissionableAmountMicro(
      row.userId,
      row.bonusCredited,
    );
    if (payable <= 0n) continue;

    await distributeReferralCommissions({
      sourceUserId: row.userId,
      amountMicro: row.bonusCredited,
      ratesBps: config.commissionRatesBps,
      sourceTradeId: row.id,
      payableMicro: payable,
    });
    tradesBackfilled += 1;
  }

  return { yieldsBackfilled, tradesBackfilled };
}
