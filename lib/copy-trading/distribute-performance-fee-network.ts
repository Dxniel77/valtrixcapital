import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  COPY_NETWORK_LEVELS,
  DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
  normalizePerformanceFeeNetworkBps,
  splitPerformanceFeeNetwork,
} from "@/lib/copy-trading/performance-fee-network";
import { resolveUplineChain } from "@/lib/services/referral-chain";

type FeeNetworkRow = {
  id: string;
  amount: bigint;
  userId: string;
};

export async function copyPerformanceFeeNetworkRates(
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number[]> {
  const copyConfig = await db.copyTradingConfig.findUnique({
    where: { id: 1 },
    select: { performanceFeeNetworkBps: true },
  });
  return normalizePerformanceFeeNetworkBps(
    copyConfig?.performanceFeeNetworkBps ?? DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
  );
}

/**
 * Pays L1–L6 from one copier's Performance Fee using the staking `referrerId`
 * tree. Credits the same withdrawable pocket as staking commissions
 * (`earningsBalance`). Idempotent per ledger row.
 */
export async function distributePerformanceFeeNetwork(
  tx: Prisma.TransactionClient,
  input: {
    sourceUserId: string;
    feeLedgerId: string;
    feeMicro: bigint;
    ratesBps: number[];
  },
): Promise<bigint> {
  if (input.feeMicro <= 0n) return 0n;

  const uplines = await resolveUplineChain(
    input.sourceUserId,
    COPY_NETWORK_LEVELS,
    tx,
  );
  const split = splitPerformanceFeeNetwork(
    input.feeMicro,
    input.ratesBps,
    uplines.length,
  );
  let paid = 0n;

  for (const payout of split.payouts) {
    const beneficiaryId = uplines[payout.level - 1];
    if (!beneficiaryId) continue;

    const existing = await tx.commission.findFirst({
      where: {
        beneficiaryId,
        sourceCopyLedgerId: input.feeLedgerId,
        level: payout.level,
      },
      select: { id: true },
    });
    if (existing) continue;

    try {
      await tx.commission.create({
        data: {
          beneficiaryId,
          sourceUserId: input.sourceUserId,
          level: payout.level,
          rateBps: payout.rateBps,
          amount: payout.amount,
          sourceCopyLedgerId: input.feeLedgerId,
        },
      });
      await tx.user.update({
        where: { id: beneficiaryId },
        data: {
          earningsBalance: { increment: payout.amount },
          totalEarned: { increment: payout.amount },
        },
      });
      paid += payout.amount;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  return paid;
}

export async function distributePerformanceFeeRows(
  tx: Prisma.TransactionClient,
  rows: FeeNetworkRow[],
  ratesBps?: number[],
): Promise<bigint> {
  if (rows.length === 0) return 0n;
  const rates = ratesBps ?? (await copyPerformanceFeeNetworkRates(tx));
  let paid = 0n;
  for (const row of rows) {
    const feeMicro = row.amount < 0n ? -row.amount : row.amount;
    paid += await distributePerformanceFeeNetwork(tx, {
      sourceUserId: row.userId,
      feeLedgerId: row.id,
      feeMicro,
      ratesBps: rates,
    });
  }
  return paid;
}

function toFeeNetworkRows(
  rows: Array<{
    id: string;
    amount: bigint;
    investment: { userId: string };
  }>,
): FeeNetworkRow[] {
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    userId: row.investment.userId,
  }));
}

/** Heals a closed live result whose Performance Fee never paid the upline. */
export async function ensurePerformanceFeeNetworkForEvent(
  performanceEventId: string,
): Promise<bigint> {
  return prisma.$transaction(async (tx) => {
    const feeRows = await tx.copyInvestmentLedger.findMany({
      where: { performanceId: performanceEventId, kind: "PERFORMANCE_FEE" },
      select: {
        id: true,
        amount: true,
        investment: { select: { userId: true } },
      },
    });
    return distributePerformanceFeeRows(tx, toFeeNetworkRows(feeRows));
  });
}

/** Replays unpaid copy Performance Fee shares for these copiers (safe to rerun). */
export async function backfillCopyPerformanceFeeNetworkForUsers(
  sourceUserIds: string[],
): Promise<number> {
  if (sourceUserIds.length === 0) return 0;

  const unpaid = await prisma.copyInvestmentLedger.findMany({
    where: {
      kind: "PERFORMANCE_FEE",
      investment: { userId: { in: sourceUserIds } },
      networkCommissions: { none: {} },
    },
    select: {
      id: true,
      amount: true,
      investment: { select: { userId: true } },
    },
  });
  if (unpaid.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await distributePerformanceFeeRows(tx, toFeeNetworkRows(unpaid));
  });
  return unpaid.length;
}

/** Replays unpaid copy Performance Fee shares for every copier (safe to rerun). */
export async function backfillMissedCopyPerformanceFeeNetwork(): Promise<number> {
  const unpaid = await prisma.copyInvestmentLedger.findMany({
    where: {
      kind: "PERFORMANCE_FEE",
      networkCommissions: { none: {} },
    },
    select: {
      id: true,
      amount: true,
      investment: { select: { userId: true } },
    },
  });
  if (unpaid.length === 0) return 0;

  await prisma.$transaction(
    async (tx) => {
      await distributePerformanceFeeRows(tx, toFeeNetworkRows(unpaid));
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
  return unpaid.length;
}
