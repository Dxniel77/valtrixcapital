import { prisma } from "@/lib/db";
import { computeNetworkLevels } from "@/lib/admin/network-tree";
import type { AdminUser } from "@/lib/admin/store";
import { DEFAULT_WITHDRAWAL_RULE } from "@/lib/admin/withdrawal-eligibility";
import { listUsersForAdmin } from "@/lib/services/users";
import { fromMicro } from "@/lib/utils";

export type LeaderPeriod = "week" | "month" | "3months";

const PERIOD_MS: Record<LeaderPeriod, number> = {
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
  "3months": 90 * 86_400_000,
};

export interface AdminLeaderLevelDto {
  level: number;
  amount: number;
}

export interface AdminLeaderRowDto {
  userId: string;
  wallet: string;
  alias: string;
  registrationSource: "referral" | "direct";
  isDirectAccount: boolean;
  total: number;
  operational: number;
  network: number;
  passive: number;
  tradesCount: number;
  winsCount: number;
  byLevel: AdminLeaderLevelDto[];
}

export interface DirectAccountsSummaryDto {
  accountCount: number;
  total: number;
  operational: number;
  network: number;
  passive: number;
  tradesCount: number;
  winsCount: number;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function mapUsersToAdmin(users: Awaited<ReturnType<typeof listUsersForAdmin>>): AdminUser[] {
  return users.map((u) => ({
    id: u.id,
    alias: u.username?.trim() || u.walletAddress.slice(0, 6),
    wallet: u.walletAddress,
    role: u.role,
    status: u.isActive ? "ACTIVE" : "INACTIVE",
    network: "BSC" as const,
    capital: u.lockedCapital,
    realCapital: u.realCapital,
    companyCapital: u.companyCapital,
    balance: u.earningsBalance,
    totalEarned: u.totalEarned,
    referrals: u.directReferrals,
    uplineWallet: u.referrerWallet,
    referrerUsername: u.referrerUsername,
    registrationSource: u.registrationSource,
    joinedAt: Date.parse(u.createdAt) || Date.now(),
    accountGranted: u.accountGranted,
    withdrawalUnlocked: u.withdrawalUnlocked,
    withdrawalAllowance: u.withdrawalAllowance ?? 0,
    ibStrategyId: u.ibStrategyId ?? null,
    ibBoost: u.ibBoost ?? null,
    isIb: u.isIb ?? false,
    avatarUrl: u.isIb ? u.avatarUrl ?? null : null,
    ibNetDeposit: u.ibNetDeposit ?? null,
    withdrawalRule: u.withdrawalRule ?? DEFAULT_WITHDRAWAL_RULE,
    directSalesVolume: u.directSalesVolume,
    levelVolumes: u.levelVolumes,
    operationalEarned: 0,
    networkEarned: 0,
    passiveEarned: 0,
  }));
}

function computeLevelDeposits(
  user: AdminUser,
  allUsers: AdminUser[],
  depositsByWallet: Map<string, number>,
): AdminLeaderLevelDto[] {
  const levels = computeNetworkLevels(user.wallet, allUsers);
  return levels.map(({ level, members }) => {
    const amount = members.reduce(
      (acc, m) => acc + (depositsByWallet.get(m.wallet.toLowerCase()) ?? 0),
      0,
    );
    return { level, amount: round(amount) };
  });
}

export async function listAdminLeaderRows(
  period: LeaderPeriod,
): Promise<{
  rows: AdminLeaderRowDto[];
  directAccounts: DirectAccountsSummaryDto;
}> {
  const sinceMs = Date.now() - PERIOD_MS[period];
  const since = new Date(sinceMs);

  const usersDto = await listUsersForAdmin();
  const adminUsers = mapUsersToAdmin(usersDto);
  const activeUsers = adminUsers.filter((u) => u.status === "ACTIVE");

  const [tradeAgg, tradeWinAgg, yieldAgg, commissionAgg, deposits] =
    await Promise.all([
      prisma.trade.groupBy({
        by: ["userId"],
        where: { openedAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.trade.groupBy({
        by: ["userId"],
        where: {
          result: "WIN",
          resolvedAt: { gte: since },
          bonusCredited: { gt: 0n },
        },
        _sum: { bonusCredited: true },
        _count: { _all: true },
      }),
      prisma.dailyYieldRecord.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: since } },
        _sum: { creditedAmount: true },
      }),
      prisma.commission.groupBy({
        by: ["beneficiaryId"],
        where: { createdAt: { gte: since } },
        _sum: { amount: true },
      }),
      prisma.deposit.findMany({
        where: {
          status: "CONFIRMED",
          OR: [
            { confirmedAt: { gte: since } },
            { confirmedAt: null, detectedAt: { gte: since } },
          ],
        },
        select: {
          amount: true,
          user: { select: { walletAddress: true } },
        },
      }),
    ]);

  const tradesByUser = new Map(
    tradeAgg.map((r) => [r.userId, r._count._all]),
  );
  const winsByUser = new Map(
    tradeWinAgg.map((r) => [r.userId, r._count._all]),
  );
  const operationalByUser = new Map(
    tradeWinAgg.map((r) => [r.userId, fromMicro(r._sum.bonusCredited ?? 0n)]),
  );
  const passiveByUser = new Map(
    yieldAgg.map((r) => [r.userId, fromMicro(r._sum.creditedAmount ?? 0n)]),
  );
  const networkByUser = new Map(
    commissionAgg.map((r) => [r.beneficiaryId, fromMicro(r._sum.amount ?? 0n)]),
  );

  const depositsByWallet = new Map<string, number>();
  for (const d of deposits) {
    const key = d.user.walletAddress.toLowerCase();
    depositsByWallet.set(
      key,
      round((depositsByWallet.get(key) ?? 0) + fromMicro(d.amount)),
    );
  }

  const rows: AdminLeaderRowDto[] = [];

  for (const user of activeUsers) {
    const operational = round(operationalByUser.get(user.id) ?? 0);
    const passive = round(passiveByUser.get(user.id) ?? 0);
    const network = round(networkByUser.get(user.id) ?? 0);
    const tradesCount = tradesByUser.get(user.id) ?? 0;
    const winsCount = winsByUser.get(user.id) ?? 0;
    const total = round(operational + passive + network);

    if (
      total <= 0 &&
      tradesCount <= 0 &&
      user.totalEarned <= 0
    ) {
      continue;
    }

    rows.push({
      userId: user.id,
      wallet: user.wallet,
      alias: user.alias,
      registrationSource: user.registrationSource,
      isDirectAccount: !user.uplineWallet,
      total,
      operational,
      network,
      passive,
      tradesCount,
      winsCount,
      byLevel: computeLevelDeposits(user, adminUsers, depositsByWallet),
    });
  }

  rows.sort((a, b) => b.total - a.total || b.tradesCount - a.tradesCount);

  const directRows = rows.filter((r) => r.isDirectAccount);
  const directAccounts: DirectAccountsSummaryDto = {
    accountCount: directRows.length,
    total: round(directRows.reduce((a, r) => a + r.total, 0)),
    operational: round(directRows.reduce((a, r) => a + r.operational, 0)),
    network: round(directRows.reduce((a, r) => a + r.network, 0)),
    passive: round(directRows.reduce((a, r) => a + r.passive, 0)),
    tradesCount: directRows.reduce((a, r) => a + r.tradesCount, 0),
    winsCount: directRows.reduce((a, r) => a + r.winsCount, 0),
  };

  return { rows, directAccounts };
}
