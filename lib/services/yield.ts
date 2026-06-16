import { prisma } from "@/lib/db";
import { getPlatformConfig } from "@/lib/services/config";
import { refreshUserPayoutCap } from "@/lib/services/stakes";

const PASSIVE_YIELD_DELAY_MS = 24 * 60 * 60 * 1000;
const PAYOUT_CAP_MULTIPLIER = 2;

function utcDayKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function endOfUtcDayMs(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 23, 59, 59, 999);
}

function stakeEligibleForPassiveYield(
  confirmedAt: Date,
  dayKey: string,
): boolean {
  return confirmedAt.getTime() + PASSIVE_YIELD_DELAY_MS <= endOfUtcDayMs(dayKey);
}

function enumerateAccrualDays(
  stakes: Array<{ startedAt: Date; deposit: { confirmedAt: Date | null } | null }>,
  today: string,
): string[] {
  if (stakes.length === 0) return [];
  const firstEligibleMs = Math.min(
    ...stakes.map(
      (s) =>
        (s.deposit?.confirmedAt ?? s.startedAt).getTime() +
        PASSIVE_YIELD_DELAY_MS,
    ),
  );
  const out: string[] = [];
  const cursor = new Date(firstEligibleMs);
  cursor.setUTCHours(0, 0, 0, 0);
  while (utcDayKey(cursor.getTime()) < today) {
    out.push(utcDayKey(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function capitalActiveOn(
  stakes: Array<{
    amount: bigint;
    startedAt: Date;
    deposit: { confirmedAt: Date | null } | null;
    status: string;
  }>,
  dayKey: string,
): bigint {
  let total = 0n;
  for (const s of stakes) {
    if (s.status !== "ACTIVE") continue;
    const confirmed = s.deposit?.confirmedAt ?? s.startedAt;
    if (stakeEligibleForPassiveYield(confirmed, dayKey)) {
      total += s.amount;
    }
  }
  return total;
}

function computeDailyRate(
  wins: number,
  config: Awaited<ReturnType<typeof getPlatformConfig>>,
) {
  const safeWins = Math.max(0, Math.min(wins, config.maxTradesPerDay));
  const bonusRateBps = safeWins * config.bonusPerWinBps;
  const totalRateBps = Math.min(
    config.baseYieldBps + bonusRateBps,
    config.maxDailyYieldBps,
  );
  return {
    baseRateBps: config.baseYieldBps,
    bonusRateBps,
    totalRateBps,
    wins: safeWins,
  };
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

export async function accrueDailyYieldsForAllUsers(): Promise<YieldRunResult> {
  const config = await getPlatformConfig();
  const today = utcDayKey();
  let usersProcessed = 0;
  let recordsCreated = 0;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const { id: userId } of users) {
    const created = await accrueDailyYieldsForUser(userId, config, today);
    if (created > 0) usersProcessed += 1;
    recordsCreated += created;
  }

  return { usersProcessed, recordsCreated };
}

async function accrueDailyYieldsForUser(
  userId: string,
  config: Awaited<ReturnType<typeof getPlatformConfig>>,
  today: string,
): Promise<number> {
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

  const existing = await prisma.dailyYieldRecord.findMany({
    where: { userId },
    select: { date: true },
  });
  const existingDays = new Set(
    existing.map((r) => r.date.toISOString().slice(0, 10)),
  );

  const targets = enumerateAccrualDays(user.stakes, today).filter(
    (d) => !existingDays.has(d),
  );
  if (targets.length === 0) return 0;

  let recordsCreated = 0;
  let earningsBalance = user.earningsBalance;
  let totalEarned = user.totalEarned;
  const payoutCap =
    user.payoutCap > 0n ? user.payoutCap : user.lockedCapital * BigInt(PAYOUT_CAP_MULTIPLIER);

  for (const dateKey of targets) {
    const capital = capitalActiveOn(user.stakes, dateKey);
    if (capital <= 0n) continue;

    const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateKey}T23:59:59.999Z`);

    const trades = await prisma.trade.findMany({
      where: {
        userId,
        openedAt: { gte: dayStart, lte: dayEnd },
        result: { not: null },
      },
      select: { result: true },
    });
    const wins = trades.filter((t) => t.result === "WIN").length;
    const rate = computeDailyRate(wins, config);
    const rawCredit = (capital * BigInt(rate.totalRateBps)) / 10_000n;
    const applied = applyEarningsCredit(totalEarned, payoutCap, rawCredit);
    if (applied <= 0n) continue;

    const record = await prisma.dailyYieldRecord.create({
      data: {
        userId,
        date: new Date(`${dateKey}T12:00:00.000Z`),
        baseRateBps: rate.baseRateBps,
        winsCount: rate.wins,
        bonusRateBps: rate.bonusRateBps,
        totalRateBps: rate.totalRateBps,
        capitalSnapshot: capital,
        creditedAmount: applied,
      },
    });

    earningsBalance += applied;
    totalEarned += applied;
    recordsCreated += 1;

    await distributeCommissions(record.id, userId, applied, config.commissionRatesBps);
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

async function distributeCommissions(
  sourceYieldId: string,
  sourceUserId: string,
  yieldMicro: bigint,
  ratesBps: number[],
): Promise<void> {
  let currentId: string | null = sourceUserId;

  for (let level = 1; level <= ratesBps.length; level += 1) {
    if (!currentId) break;

    const source: { referrerId: string | null } | null =
      await prisma.user.findUnique({
        where: { id: currentId },
        select: { referrerId: true },
      });
    const referrerId: string | null = source?.referrerId ?? null;
    if (!referrerId) break;

    const rateBps = ratesBps[level - 1] ?? 0;
    if (rateBps <= 0) {
      currentId = referrerId;
      continue;
    }

    const amount = (yieldMicro * BigInt(rateBps)) / 10_000n;
    if (amount <= 0n) {
      currentId = referrerId;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.commission.create({
        data: {
          beneficiaryId: referrerId,
          sourceUserId,
          level,
          rateBps,
          amount,
          sourceYieldId,
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

    currentId = referrerId;
  }
}

export async function runDailyYieldCron(): Promise<YieldRunResult> {
  return accrueDailyYieldsForAllUsers();
}
