import type { StakeStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const ACTIVE_CAPITAL_STATUSES: StakeStatus[] = ["ACTIVE"];
const COMMISSION_CAPITAL_STATUSES: StakeStatus[] = ["ACTIVE", "COMPLETED"];

function isRealStake(source: string, depositId: string | null): boolean {
  return source === "ON_CHAIN" || depositId != null;
}

function sumBreakdown(
  stakes: Array<{ amount: bigint; source: string; depositId: string | null }>,
): { real: bigint; company: bigint } {
  let real = 0n;
  let company = 0n;
  for (const stake of stakes) {
    if (isRealStake(stake.source, stake.depositId)) {
      real += stake.amount;
    } else {
      company += stake.amount;
    }
  }
  return { real, company };
}

function reconcileWithDeposits(input: {
  real: bigint;
  company: bigint;
  depositReal: bigint;
  locked: bigint;
}): { real: bigint; company: bigint } {
  let { real, company, depositReal, locked } = input;

  if (depositReal > real) {
    real = depositReal > locked && locked > 0n ? locked : depositReal;
    company = locked > real ? locked - real : 0n;
  }

  if (real <= 0n && company <= 0n && depositReal > 0n) {
    real = depositReal;
  }

  return { real, company };
}

async function getStakeBreakdown(
  userId: string,
  statuses: StakeStatus[],
): Promise<{ real: bigint; company: bigint }> {
  const stakes = await prisma.stake.findMany({
    where: { userId, status: { in: statuses } },
    select: { amount: true, source: true, depositId: true },
  });
  return sumBreakdown(stakes);
}

async function getConfirmedDepositTotal(userId: string): Promise<bigint> {
  const agg = await prisma.deposit.aggregate({
    where: { userId, status: "CONFIRMED" },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0n;
}

/** Sum of active stake amounts from on-chain deposits (real user money). */
export async function getRealCapitalMicro(userId: string): Promise<bigint> {
  const { real } = await getStakeBreakdown(userId, ACTIVE_CAPITAL_STATUSES);
  return real;
}

/** Sum of active company-sponsored stake amounts (no linked deposit). */
export async function getCompanyCapitalMicro(userId: string): Promise<bigint> {
  const { company } = await getStakeBreakdown(userId, ACTIVE_CAPITAL_STATUSES);
  return company;
}

/**
 * Share of earnings that may generate upline commissions.
 * Only real deposited capital counts — company-sponsored capital is excluded.
 */
export async function getCommissionableRatio(userId: string): Promise<number> {
  const { real, company } = await getStakeBreakdown(
    userId,
    COMMISSION_CAPITAL_STATUSES,
  );
  const total = real + company;
  if (total <= 0n) return 0;
  return Number(real) / Number(total);
}

/** Scale a commission base amount to the real-capital portion only. */
export function scaleCommissionableAmount(
  amountMicro: bigint,
  real: bigint,
  company: bigint,
): bigint {
  if (amountMicro <= 0n) return 0n;
  const total = real + company;
  if (total <= 0n || real <= 0n) return 0n;
  if (company <= 0n) return amountMicro;
  return (amountMicro * real) / total;
}

async function getCommissionCapitalBreakdown(
  userId: string,
): Promise<{ real: bigint; company: bigint }> {
  const [{ real: stakeReal, company: stakeCompany }, depositReal, user] =
    await Promise.all([
      getStakeBreakdown(userId, COMMISSION_CAPITAL_STATUSES),
      getConfirmedDepositTotal(userId),
      prisma.user.findUnique({
        where: { id: userId },
        select: { lockedCapital: true },
      }),
    ]);

  return reconcileWithDeposits({
    real: stakeReal,
    company: stakeCompany,
    depositReal,
    locked: user?.lockedCapital ?? 0n,
  });
}

/** Scale earnings to the commissionable (real-capital) portion for upline payouts. */
export async function commissionableAmountMicro(
  userId: string,
  amountMicro: bigint,
): Promise<bigint> {
  if (amountMicro <= 0n) return 0n;

  const { real, company } = await getCommissionCapitalBreakdown(userId);
  if (real <= 0n) return 0n;

  return scaleCommissionableAmount(amountMicro, real, company);
}

/**
 * Real invested volume for unlock rules and sponsor progress.
 * Confirmed on-chain deposits are authoritative direct sales volume.
 */
export async function getRealUnlockVolumeMicro(userId: string): Promise<bigint> {
  const depositReal = await getConfirmedDepositTotal(userId);
  if (depositReal > 0n) return depositReal;

  const { real } = await getCommissionCapitalBreakdown(userId);
  return real;
}

/** Sum of real unlock volume across referral user ids (skips $0 / company-only). */
export async function sumRealUnlockVolumeForUsers(
  userIds: string[],
): Promise<bigint> {
  if (userIds.length === 0) return 0n;

  let total = 0n;
  for (const userId of userIds) {
    const real = await getRealUnlockVolumeMicro(userId);
    if (real > 0n) total += real;
  }
  return total;
}

/** True when a user's earnings may generate upline network commissions. */
export async function generatesUplineCommissions(userId: string): Promise<boolean> {
  return (await getRealUnlockVolumeMicro(userId)) > 0n;
}

/** Batch capital breakdown for many users (admin lists, API). */
export async function getCapitalBreakdownMap(
  userIds: string[],
): Promise<Map<string, { real: bigint; company: bigint }>> {
  const map = new Map<string, { real: bigint; company: bigint }>();
  if (userIds.length === 0) return map;

  const [stakes, deposits, users] = await Promise.all([
    prisma.stake.findMany({
      where: { userId: { in: userIds }, status: { in: COMMISSION_CAPITAL_STATUSES } },
      select: { userId: true, amount: true, source: true, depositId: true },
    }),
    prisma.deposit.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "CONFIRMED" },
      _sum: { amount: true },
    }),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, lockedCapital: true },
    }),
  ]);

  const depositMap = new Map(
    deposits.map((d) => [d.userId, d._sum.amount ?? 0n]),
  );
  const lockedMap = new Map(users.map((u) => [u.id, u.lockedCapital]));

  for (const id of userIds) {
    map.set(id, { real: 0n, company: 0n });
  }
  for (const stake of stakes) {
    const entry = map.get(stake.userId);
    if (!entry) continue;
    if (isRealStake(stake.source, stake.depositId)) {
      entry.real += stake.amount;
    } else {
      entry.company += stake.amount;
    }
  }

  for (const id of userIds) {
    const entry = map.get(id)!;
    const reconciled = reconcileWithDeposits({
      real: entry.real,
      company: entry.company,
      depositReal: depositMap.get(id) ?? 0n,
      locked: lockedMap.get(id) ?? 0n,
    });
    entry.real = reconciled.real;
    entry.company = reconciled.company;
  }

  return map;
}
