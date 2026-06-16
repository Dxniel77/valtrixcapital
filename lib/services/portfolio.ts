import { prisma } from "@/lib/db";
import { fromMicro } from "@/lib/utils";
import { listUserDeposits } from "@/lib/services/deposits";
import { listUserStakes } from "@/lib/services/stakes";
import { listUserWithdrawals } from "@/lib/services/withdrawals";
import { REQUIRED_CONFIRMATIONS } from "@/lib/staking/constants";
import type {
  DailyYieldDto,
  PortfolioDto,
  StakeDto,
} from "@/lib/staking/portfolio-types";
import type { PendingDeposit, StakingNetwork } from "@/lib/staking/store";

export type { PortfolioDto, StakeDto, DailyYieldDto, WithdrawalDto } from "@/lib/staking/portfolio-types";

function pendingFromDeposit(d: {
  id: string;
  amount: number;
  network: StakingNetwork;
  txHash: string;
  confirmations: number;
  detectedAt: string;
}): PendingDeposit {
  return {
    id: d.id,
    serverDepositId: d.id,
    amount: d.amount,
    network: d.network,
    txHash: d.txHash,
    startedAt: new Date(d.detectedAt).getTime(),
    confirmations: d.confirmations,
    requiredConfirmations: REQUIRED_CONFIRMATIONS,
  };
}

export async function getUserPortfolio(userId: string): Promise<PortfolioDto> {
  const [user, stakes, deposits, dailyRows, withdrawals] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    listUserStakes(userId),
    listUserDeposits(userId),
    prisma.dailyYieldRecord.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 500,
    }),
    listUserWithdrawals(userId),
  ]);

  const pending = deposits.find((d) => d.status === "PENDING") ?? null;

  const dailyYields: DailyYieldDto[] = dailyRows.map((y) => ({
    id: y.id,
    date: y.date.toISOString().slice(0, 10),
    capitalSnapshot: fromMicro(y.capitalSnapshot),
    baseRateBps: y.baseRateBps,
    bonusRateBps: y.bonusRateBps,
    totalRateBps: y.totalRateBps,
    wins: y.winsCount,
    losses: 0,
    creditedAmount: fromMicro(y.creditedAmount),
    createdAt: y.createdAt.getTime(),
  }));

  return {
    earningsBalance: fromMicro(user.earningsBalance),
    totalEarned: fromMicro(user.totalEarned),
    lockedCapital: fromMicro(user.lockedCapital),
    stakes,
    pendingDeposit: pending ? pendingFromDeposit({ ...pending, network: pending.network as StakingNetwork }) : null,
    dailyYields,
    withdrawals,
  };
}
