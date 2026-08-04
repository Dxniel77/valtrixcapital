import { prisma } from "@/lib/db";
import { getPlatformConfig } from "@/lib/services/config";
import { refreshUserPayoutCap } from "@/lib/services/stakes";
import {
  backfillMissedReferralCommissions,
  distributeReferralCommissions,
} from "@/lib/services/commissions";
import { commissionableAmountMicro } from "@/lib/services/sponsored-capital";
import {
  countPassivePeriodsDue,
  MAX_PASSIVE_CATCHUP_PERIODS,
  passiveCreditMicroForPeriod,
} from "@/lib/yield/passive-accrual";
import {
  getPassiveYieldDelayMs,
  getYieldAccrualIntervalMs,
} from "@/lib/yield/timing";
import { getUserIbYieldBoost } from "@/lib/services/ib-strategy";

const PAYOUT_CAP_MULTIPLIER = 2;

function isRealStake(source: string, depositId: string | null): boolean {
  return source === "ON_CHAIN" || depositId != null;
}

type YieldStakeRow = {
  amount: bigint;
  source: string;
  depositId: string | null;
  startedAt: Date;
  deposit: { confirmedAt: Date | null } | null;
  status: string;
};

/** Company-sponsored leader accounts accrue passive yield only on real deposits. */
function stakesForPassiveYield(
  stakes: YieldStakeRow[],
  accountGranted: boolean,
): YieldStakeRow[] {
  if (!accountGranted) return stakes;
  return stakes.filter((s) => isRealStake(s.source, s.depositId));
}

function utcDayKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function stakeConfirmedAt(
  stake: Pick<YieldStakeRow, "startedAt" | "deposit">,
): number {
  return (stake.deposit?.confirmedAt ?? stake.startedAt).getTime();
}

function stakeEligibleNow(confirmedAtMs: number, nowMs: number): boolean {
  return confirmedAtMs + getPassiveYieldDelayMs() <= nowMs;
}

function firstPassiveEligibleAtMs(stakes: YieldStakeRow[]): number {
  return Math.min(
    ...stakes.map((s) => stakeConfirmedAt(s) + getPassiveYieldDelayMs()),
  );
}

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

export interface YieldRunResult {
  usersProcessed: number;
  recordsCreated: number;
}

/**
 * Credits base passive yield (0.3%) on a rolling interval (default 24h) after the
 * initial delay from stake/deposit confirmation. Trade-win bonuses (+0.1% each)
 * are paid instantly as operational credits — not included here.
 */
export async function accruePassiveYieldForUser(
  userId: string,
  config?: Awaited<ReturnType<typeof getPlatformConfig>>,
): Promise<number> {
  const platformConfig = config ?? (await getPlatformConfig());
  const intervalMs = getYieldAccrualIntervalMs();
  const now = Date.now();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      stakes: {
        where: { status: "ACTIVE" },
        include: { deposit: true },
      },
    },
  });
  if (!user || user.stakes.length === 0) return 0;

  const passiveStakes = stakesForPassiveYield(user.stakes, user.accountGranted);
  if (passiveStakes.length === 0) return 0;

  const firstEligibleAtMs = firstPassiveEligibleAtMs(passiveStakes);
  if (now < firstEligibleAtMs) return 0;

  const eligibleStakes = passiveStakes.filter((s) =>
    stakeEligibleNow(stakeConfirmedAt(s), now),
  );
  if (eligibleStakes.length === 0) return 0;

  const capital = eligibleStakes.reduce((acc, s) => acc + s.amount, 0n);
  if (capital <= 0n) return 0;

  const lastRecord = await prisma.dailyYieldRecord.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const periodsDue = Math.min(
    countPassivePeriodsDue({
      nowMs: now,
      firstEligibleAtMs,
      lastAccrualAtMs: lastRecord?.createdAt.getTime() ?? null,
      intervalMs,
    }),
    MAX_PASSIVE_CATCHUP_PERIODS,
  );
  if (periodsDue <= 0) return 0;

  const ibBoost = await getUserIbYieldBoost(userId);
  const effectiveBaseBps =
    platformConfig.baseYieldBps + ibBoost.passiveBonusBps;

  const periodCredit = passiveCreditMicroForPeriod(
    capital,
    effectiveBaseBps,
    intervalMs,
  );
  if (periodCredit <= 0n) return 0;

  const payoutCap =
    user.payoutCap > 0n
      ? user.payoutCap
      : user.lockedCapital * BigInt(PAYOUT_CAP_MULTIPLIER);

  let recordsCreated = 0;
  let earningsBalance = user.earningsBalance;
  let totalEarned = user.totalEarned;
  let lastAccrualAtMs =
    lastRecord?.createdAt.getTime() ?? firstEligibleAtMs - intervalMs;

  for (let i = 0; i < periodsDue; i += 1) {
    const applied = applyEarningsCredit(totalEarned, payoutCap, periodCredit);
    if (applied <= 0n) break;

    lastAccrualAtMs += intervalMs;
    const recordDate = utcDayKey(lastAccrualAtMs);

    const record = await prisma.dailyYieldRecord.create({
      data: {
        userId,
        date: new Date(`${recordDate}T12:00:00.000Z`),
        baseRateBps: effectiveBaseBps,
        winsCount: 0,
        bonusRateBps: 0,
        totalRateBps: effectiveBaseBps,
        capitalSnapshot: capital,
        creditedAmount: applied,
      },
    });

    earningsBalance += applied;
    totalEarned += applied;
    recordsCreated += 1;

    const payableMicro = await commissionableAmountMicro(userId, applied);
    if (payableMicro > 0n) {
      await distributeReferralCommissions({
        sourceUserId: userId,
        amountMicro: applied,
        ratesBps: platformConfig.commissionRatesBps,
        sourceYieldId: record.id,
        payableMicro,
      });
    }
  }

  if (recordsCreated > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { earningsBalance, totalEarned },
    });

    if (payoutCap > 0n && totalEarned >= payoutCap) {
      await prisma.stake.updateMany({
        where: { userId, status: "ACTIVE" },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }

    await refreshUserPayoutCap(userId);
  }

  return recordsCreated;
}

export async function accrueDailyYieldsForAllUsers(): Promise<YieldRunResult> {
  const config = await getPlatformConfig();
  let usersProcessed = 0;
  let recordsCreated = 0;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const { id: userId } of users) {
    const created = await accruePassiveYieldForUser(userId, config);
    if (created > 0) usersProcessed += 1;
    recordsCreated += created;
  }

  return { usersProcessed, recordsCreated };
}

export async function runDailyYieldCron(): Promise<
  YieldRunResult & { yieldsBackfilled: number; tradesBackfilled: number }
> {
  const result = await accrueDailyYieldsForAllUsers();
  const backfill = await backfillMissedReferralCommissions();
  return { ...result, ...backfill };
}
