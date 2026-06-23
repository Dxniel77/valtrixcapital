import { prisma } from "@/lib/db";
import { fromMicro } from "@/lib/utils";

export interface WithdrawalFeeRowDto {
  id: string;
  wallet: string;
  gross: number;
  fee: number;
  net: number;
  network: string;
  processedAt: number;
}

export interface AdminCashFlowSummaryDto {
  inflow: number;
  outflow: number;
  net: number;
  pendingOutflow: number;
  depositCount: number;
  withdrawalCount: number;
  yieldPaid: number;
  tradeBonusPaid: number;
  referralCommissionPaid: number;
  withdrawalFeesEarned: number;
  withdrawalFees: WithdrawalFeeRowDto[];
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

const PAID_WITHDRAWAL_STATUSES = ["CONFIRMED", "SENT"] as const;
const PENDING_WITHDRAWAL_STATUSES = ["REQUESTED", "APPROVED"] as const;

/** Deposits confirmed in range (uses confirmedAt, falling back to detectedAt). */
function confirmedDepositInRange(from: Date, to: Date) {
  return {
    status: "CONFIRMED" as const,
    OR: [
      { confirmedAt: { gte: from, lte: to } },
      {
        confirmedAt: null,
        detectedAt: { gte: from, lte: to },
      },
    ],
  };
}

function treasuryDepositInRange(from: Date, to: Date) {
  return {
    status: "CONFIRMED" as const,
    OR: [
      { confirmedAt: { gte: from, lte: to } },
      {
        confirmedAt: null,
        startedAt: { gte: from, lte: to },
      },
    ],
  };
}

function withdrawalInRange(from: Date, to: Date) {
  return {
    OR: [
      { processedAt: { gte: from, lte: to } },
      {
        processedAt: null,
        requestedAt: { gte: from, lte: to },
      },
    ],
  };
}

export async function getAdminCashFlowSummary(
  fromMs: number,
  toMs: number,
): Promise<AdminCashFlowSummaryDto> {
  const from = new Date(fromMs);
  const to = new Date(toMs);

  const [
    userDeposits,
    treasuryDeposits,
    paidWithdrawals,
    pendingWithdrawals,
    manualTreasuryOut,
    yieldAgg,
    tradeBonusAgg,
    commissionAgg,
  ] = await Promise.all([
    prisma.deposit.aggregate({
      where: confirmedDepositInRange(from, to),
      _sum: { amount: true },
      _count: true,
    }),
    prisma.treasuryDeposit.aggregate({
      where: treasuryDepositInRange(from, to),
      _sum: { amount: true },
      _count: true,
    }),
    prisma.withdrawal.findMany({
      where: {
        status: { in: [...PAID_WITHDRAWAL_STATUSES] },
        ...withdrawalInRange(from, to),
      },
      include: { user: { select: { walletAddress: true } } },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.withdrawal.aggregate({
      where: {
        status: { in: [...PENDING_WITHDRAWAL_STATUSES] },
        requestedAt: { gte: from, lte: to },
      },
      _sum: { netAmount: true },
    }),
    prisma.treasuryWithdrawal.aggregate({
      where: {
        kind: "MANUAL",
        createdAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    }),
    prisma.dailyYieldRecord.aggregate({
      where: { date: { gte: from, lte: to } },
      _sum: { creditedAmount: true },
    }),
    prisma.trade.aggregate({
      where: {
        result: "WIN",
        resolvedAt: { not: null, gte: from, lte: to },
      },
      _sum: { bonusCredited: true },
    }),
    prisma.commission.aggregate({
      where: { createdAt: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
  ]);

  const userDepositIn = userDeposits._sum.amount ?? 0n;
  const treasuryDepositIn = treasuryDeposits._sum.amount ?? 0n;
  const inflow = round(fromMicro(userDepositIn + treasuryDepositIn));

  let outflowMicro = 0n;
  let feesMicro = 0n;
  const withdrawalFees: WithdrawalFeeRowDto[] = [];

  for (const w of paidWithdrawals) {
    outflowMicro += w.netAmount;
    feesMicro += w.fee;
    withdrawalFees.push({
      id: w.id,
      wallet: w.user.walletAddress,
      gross: fromMicro(w.amount),
      fee: fromMicro(w.fee),
      net: fromMicro(w.netAmount),
      network: w.network,
      processedAt: (w.processedAt ?? w.requestedAt).getTime(),
    });
  }

  outflowMicro += manualTreasuryOut._sum.amount ?? 0n;

  const outflow = round(fromMicro(outflowMicro));
  const withdrawalFeesEarned = round(fromMicro(feesMicro));

  return {
    inflow,
    outflow,
    net: round(inflow - outflow),
    pendingOutflow: round(fromMicro(pendingWithdrawals._sum.netAmount ?? 0n)),
    depositCount:
      (userDeposits._count ?? 0) + (treasuryDeposits._count ?? 0),
    withdrawalCount: paidWithdrawals.length,
    yieldPaid: round(fromMicro(yieldAgg._sum.creditedAmount ?? 0n)),
    tradeBonusPaid: round(fromMicro(tradeBonusAgg._sum.bonusCredited ?? 0n)),
    referralCommissionPaid: round(fromMicro(commissionAgg._sum.amount ?? 0n)),
    withdrawalFeesEarned,
    withdrawalFees,
  };
}
