import { prisma } from "@/lib/db";
import { REFERRAL_LEVELS, MIN_ACTIVE_CAPITAL_USDT } from "@/lib/referrals/constants";
import { countNetworkReferrals } from "@/lib/referrals/downline-tree";
import { fromMicro } from "@/lib/utils";
import { getRealUnlockVolumeMicro } from "@/lib/services/sponsored-capital";
import { backfillCommissionsForUserIds } from "@/lib/services/commissions";
import { backfillCopyPerformanceFeeNetworkForUsers } from "@/lib/copy-trading/distribute-performance-fee-network";
import { accruePassiveYieldForUser } from "@/lib/services/yield";
import { repairRealStakeSourcesForUsers } from "@/lib/services/stake-repair";
import { resolveUnlockVolumes } from "@/lib/services/unlock-volume";

export interface ReferralDownlineDto {
  id: string;
  level: number;
  wallet: string;
  displayName: string;
  isActive: boolean;
  capital: number;
  realCapital: number;
  /** Total confirmed on-chain deposits (unlock progress uses this, not active capital). */
  realDepositVolume: number;
  accountGranted: boolean;
  joinedAt: number;
  commissionsPaidToYou: number;
  directReferrals: number;
  networkReferrals: number;
  totalEarned: number;
}

export interface ReferralCommissionDto {
  id: string;
  level: number;
  sourceWallet: string;
  sourceYieldId: string | null;
  sourceTradeId: string | null;
  sourceCopyLedgerId: string | null;
  yieldDate: string;
  rateBps: number;
  amount: number;
  createdAt: number;
}

export interface UserReferralSnapshotDto {
  downline: ReferralDownlineDto[];
  commissions: ReferralCommissionDto[];
  totalCommissions: number;
}

function isActiveMember(isActive: boolean, lockedCapital: bigint): boolean {
  return isActive && fromMicro(lockedCapital) >= MIN_ACTIVE_CAPITAL_USDT;
}

export async function getUserReferralSnapshot(
  userId: string,
): Promise<UserReferralSnapshotDto> {
  await accruePassiveYieldForUser(userId);

  const viewer = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountGranted: true },
  });

  type MemberRow = {
    id: string;
    referrerId: string;
    level: number;
    walletAddress: string;
    username: string | null;
    isActive: boolean;
    lockedCapital: bigint;
    totalEarned: bigint;
    accountGranted: boolean;
    createdAt: Date;
    directReferrals: number;
  };

  const visited = new Set<string>([userId]);
  let frontier: string[] = [userId];
  const memberRows: MemberRow[] = [];

  for (let level = 1; level <= REFERRAL_LEVELS; level += 1) {
    if (frontier.length === 0) break;

    const members = await prisma.user.findMany({
      where: {
        referrerId: { in: frontier },
        id: { notIn: [...visited] },
      },
      select: {
        id: true,
        referrerId: true,
        walletAddress: true,
        username: true,
        isActive: true,
        lockedCapital: true,
        totalEarned: true,
        accountGranted: true,
        createdAt: true,
        _count: { select: { downline: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    if (members.length === 0) break;

    for (const member of members) {
      visited.add(member.id);
      memberRows.push({
        id: member.id,
        referrerId: member.referrerId!,
        level,
        walletAddress: member.walletAddress,
        username: member.username,
        isActive: member.isActive,
        lockedCapital: member.lockedCapital,
        totalEarned: member.totalEarned,
        accountGranted: member.accountGranted,
        createdAt: member.createdAt,
        directReferrals: member._count.downline,
      });
    }

    frontier = members.map((m) => m.id);
  }

  const memberIds = memberRows.map((m) => m.id);
  await repairRealStakeSourcesForUsers(memberIds);
  await backfillCommissionsForUserIds(memberIds);
  await backfillCopyPerformanceFeeNetworkForUsers(memberIds);
  if (viewer?.accountGranted) {
    await resolveUnlockVolumes(userId);
  }

  const [commissionRows, paidBySource, totalAgg] = await Promise.all([
    prisma.commission.findMany({
      where: { beneficiaryId: userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        sourceUser: { select: { walletAddress: true } },
        sourceYield: { select: { date: true } },
      },
    }),
    prisma.commission.groupBy({
      by: ["sourceUserId"],
      where: { beneficiaryId: userId },
      _sum: { amount: true },
    }),
    prisma.commission.aggregate({
      where: { beneficiaryId: userId },
      _sum: { amount: true },
    }),
  ]);

  const paidMap = new Map(
    paidBySource.map((row) => [row.sourceUserId, row._sum.amount ?? 0n]),
  );

  const commissions: ReferralCommissionDto[] = commissionRows.map((row) => ({
    id: row.id,
    level: row.level,
    sourceWallet: row.sourceUser.walletAddress,
    sourceYieldId: row.sourceYieldId,
    sourceTradeId: row.sourceTradeId,
    sourceCopyLedgerId: row.sourceCopyLedgerId,
    yieldDate: row.sourceYield
      ? row.sourceYield.date.toISOString().slice(0, 10)
      : row.createdAt.toISOString().slice(0, 10),
    rateBps: row.rateBps,
    amount: fromMicro(row.amount),
    createdAt: row.createdAt.getTime(),
  }));

  const totalCommissions = fromMicro(totalAgg._sum.amount ?? 0n);

  const downline: ReferralDownlineDto[] = await Promise.all(
    memberRows.map(async (member) => {
      const unlockVolume = await getRealUnlockVolumeMicro(member.id);
      return {
        id: member.id,
        level: member.level,
        wallet: member.walletAddress,
        displayName: member.username?.trim() || member.walletAddress.slice(0, 8),
        isActive: isActiveMember(member.isActive, member.lockedCapital),
        capital: fromMicro(member.lockedCapital),
        realCapital: fromMicro(unlockVolume),
        realDepositVolume: fromMicro(unlockVolume),
        accountGranted: member.accountGranted,
        joinedAt: member.createdAt.getTime(),
        commissionsPaidToYou: fromMicro(paidMap.get(member.id) ?? 0n),
        directReferrals: member.directReferrals,
        networkReferrals: countNetworkReferrals(member.id, memberRows),
        totalEarned: fromMicro(member.totalEarned),
      };
    }),
  );

  return { downline, commissions, totalCommissions };
}
