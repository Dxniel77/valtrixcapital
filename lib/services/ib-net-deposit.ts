import { prisma } from "@/lib/db";
import { fromMicro } from "@/lib/utils";
import { resolveUplineChain } from "@/lib/services/referral-chain";
import { getDefaultAdminActorId } from "@/lib/services/admin";

const PAYOUT_CAP_MULTIPLIER = 2n;

export interface IbAgreementDto {
  id: string;
  userId: string;
  isIb: boolean;
  netDepositEnabled: boolean;
  level1DepositBps: number;
  level2DepositBps: number;
  /** L1 only when level2DepositBps <= 0 */
  includeLevel2: boolean;
  notes: string;
  walletAddress: string;
  username: string | null;
  displayName: string;
  totalCredited: number;
  creditCount: number;
  yieldStrategyName: string | null;
  updatedAt: string;
  createdAt: string;
}

export class IbNetDepositError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "INVALID" | "FORBIDDEN" = "INVALID",
  ) {
    super(message);
    this.name = "IbNetDepositError";
  }
}

function displayName(username: string | null, wallet: string): string {
  const u = username?.trim();
  if (u) return u;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function serializeAgreement(row: {
  id: string;
  userId: string;
  isIb: boolean;
  netDepositEnabled: boolean;
  level1DepositBps: number;
  level2DepositBps: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    walletAddress: string;
    username: string | null;
    ibStrategy: { name: string; isActive: boolean } | null;
  };
  _count?: { credits: number };
  credits?: { creditedAmount: bigint }[];
}): IbAgreementDto {
  const totalCredited = (row.credits ?? []).reduce(
    (a, c) => a + c.creditedAmount,
    0n,
  );
  return {
    id: row.id,
    userId: row.userId,
    isIb: row.isIb,
    netDepositEnabled: row.netDepositEnabled,
    level1DepositBps: row.level1DepositBps,
    level2DepositBps: row.level2DepositBps,
    includeLevel2: row.level2DepositBps > 0,
    notes: row.notes,
    walletAddress: row.user.walletAddress,
    username: row.user.username,
    displayName: displayName(row.user.username, row.user.walletAddress),
    totalCredited: fromMicro(totalCredited),
    creditCount: row._count?.credits ?? row.credits?.length ?? 0,
    yieldStrategyName:
      row.user.ibStrategy?.isActive ? row.user.ibStrategy.name : null,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

const agreementInclude = {
  user: {
    select: {
      walletAddress: true,
      username: true,
      ibStrategy: { select: { name: true, isActive: true } },
    },
  },
  _count: { select: { credits: true } },
  credits: { select: { creditedAmount: true } },
} as const;

/** All IB agreements for admin monitor (who is IB + negotiation). */
export async function listIbAgreements(): Promise<IbAgreementDto[]> {
  const rows = await prisma.ibAgreement.findMany({
    where: { isIb: true },
    orderBy: [{ netDepositEnabled: "desc" }, { updatedAt: "desc" }],
    include: agreementInclude,
  });
  return rows.map(serializeAgreement);
}

export async function getIbAgreementForUser(
  userId: string,
): Promise<IbAgreementDto | null> {
  const row = await prisma.ibAgreement.findUnique({
    where: { userId },
    include: agreementInclude,
  });
  return row ? serializeAgreement(row) : null;
}

export async function upsertIbAgreement(input: {
  adminUserId: string;
  targetUserId: string;
  isIb?: boolean;
  netDepositEnabled?: boolean;
  level1DepositBps?: number;
  level2DepositBps?: number;
  includeLevel2?: boolean;
  notes?: string;
}): Promise<IbAgreementDto> {
  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true },
  });
  if (!target) throw new IbNetDepositError("User not found", "NOT_FOUND");

  const existing = await prisma.ibAgreement.findUnique({
    where: { userId: target.id },
  });

  const isIb = input.isIb ?? existing?.isIb ?? true;
  const netDepositEnabled =
    input.netDepositEnabled ?? existing?.netDepositEnabled ?? false;
  let level1DepositBps = Math.max(
    0,
    Math.round(input.level1DepositBps ?? existing?.level1DepositBps ?? 0),
  );
  let level2DepositBps = Math.max(
    0,
    Math.round(input.level2DepositBps ?? existing?.level2DepositBps ?? 0),
  );

  if (input.includeLevel2 === false) {
    level2DepositBps = 0;
  } else if (input.includeLevel2 === true && level2DepositBps <= 0) {
    throw new IbNetDepositError(
      "Level-2 Net Deposit rate must be > 0 when L2 is included",
      "INVALID",
    );
  }
  if (level1DepositBps > 10_000 || level2DepositBps > 10_000) {
    throw new IbNetDepositError("Rate cannot exceed 100%", "INVALID");
  }
  if (netDepositEnabled && level1DepositBps <= 0) {
    throw new IbNetDepositError(
      "Level-1 Net Deposit rate must be > 0 when enabled",
      "INVALID",
    );
  }
  if (!isIb && netDepositEnabled) {
    throw new IbNetDepositError(
      "Mark the user as IB before enabling Net Deposit",
      "INVALID",
    );
  }

  const notes = (input.notes ?? existing?.notes ?? "").trim();

  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.ibAgreement.upsert({
      where: { userId: target.id },
      create: {
        userId: target.id,
        isIb,
        netDepositEnabled,
        level1DepositBps,
        level2DepositBps,
        notes,
      },
      update: {
        isIb,
        netDepositEnabled,
        level1DepositBps,
        level2DepositBps,
        notes,
      },
      include: agreementInclude,
    });

    await tx.adminAction.create({
      data: {
        adminId: input.adminUserId,
        targetUserId: target.id,
        action: "UPSERT_IB_AGREEMENT",
        payload: {
          isIb,
          netDepositEnabled,
          level1DepositBps,
          level2DepositBps,
          notes,
        },
      },
    });

    return saved;
  });

  return serializeAgreement(row);
}

/**
 * After a confirmed real on-chain deposit: pay Net Deposit bonuses to L1/L2 IB uplines.
 * Idempotent per (beneficiary, depositId). Does not touch sponsored capital grants.
 */
export async function creditIbNetDepositForDeposit(input: {
  depositId: string;
  sourceUserId: string;
  depositAmountMicro: bigint;
}): Promise<number> {
  if (input.depositAmountMicro <= 0n) return 0;

  const uplines = await resolveUplineChain(input.sourceUserId, 2);
  if (uplines.length === 0) return 0;

  let credits = 0;

  for (let i = 0; i < uplines.length; i += 1) {
    const level = i + 1;
    const beneficiaryId = uplines[i]!;
    const agreement = await prisma.ibAgreement.findUnique({
      where: { userId: beneficiaryId },
    });
    if (!agreement?.isIb || !agreement.netDepositEnabled) continue;

    const rateBps =
      level === 1
        ? agreement.level1DepositBps
        : agreement.level2DepositBps > 0
          ? agreement.level2DepositBps
          : 0;
    if (rateBps <= 0) continue;

    const raw = (input.depositAmountMicro * BigInt(rateBps)) / 10_000n;
    if (raw <= 0n) continue;

    const existing = await prisma.ibNetDepositCredit.findUnique({
      where: {
        beneficiaryId_depositId: {
          beneficiaryId,
          depositId: input.depositId,
        },
      },
    });
    if (existing) continue;

    const beneficiary = await prisma.user.findUnique({
      where: { id: beneficiaryId },
      select: {
        id: true,
        earningsBalance: true,
        totalEarned: true,
        payoutCap: true,
        lockedCapital: true,
      },
    });
    if (!beneficiary) continue;

    const payoutCap =
      beneficiary.payoutCap > 0n
        ? beneficiary.payoutCap
        : beneficiary.lockedCapital * PAYOUT_CAP_MULTIPLIER;
    const room =
      payoutCap > 0n ? payoutCap - beneficiary.totalEarned : raw;
    if (room <= 0n) continue;
    const credited = raw > room ? room : raw;
    if (credited <= 0n) continue;

    // Prefer ADMIN_WALLETS, then any ADMIN role user (see getDefaultAdminActorId).
    const actorId = await getDefaultAdminActorId();

    try {
      await prisma.$transaction(async (tx) => {
        // Canonical audit of the credit (IB, source, deposit, level, rate, amount).
        await tx.ibNetDepositCredit.create({
          data: {
            beneficiaryId,
            sourceUserId: input.sourceUserId,
            depositId: input.depositId,
            agreementId: agreement.id,
            level,
            rateBps,
            depositAmount: input.depositAmountMicro,
            creditedAmount: credited,
          },
        });

        const nextEarned = beneficiary.totalEarned + credited;
        await tx.user.update({
          where: { id: beneficiaryId },
          data: {
            earningsBalance: { increment: credited },
            totalEarned: nextEarned,
          },
        });

        if (payoutCap > 0n && nextEarned >= payoutCap) {
          await tx.stake.updateMany({
            where: { userId: beneficiaryId, status: "ACTIVE" },
            data: { status: "COMPLETED", completedAt: new Date() },
          });
        }

        // Admin audit UI entry — always written when a platform admin exists.
        if (actorId) {
          await tx.adminAction.create({
            data: {
              adminId: actorId,
              targetUserId: beneficiaryId,
              action: "IB_NET_DEPOSIT_CREDIT",
              payload: {
                depositId: input.depositId,
                sourceUserId: input.sourceUserId,
                level,
                rateBps,
                depositAmount: fromMicro(input.depositAmountMicro),
                creditedAmount: fromMicro(credited),
              },
            },
          });
        }
      });
      credits += 1;
    } catch (err) {
      // Unique violation = already credited
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      if (code === "P2002") continue;
      throw err;
    }
  }

  return credits;
}
