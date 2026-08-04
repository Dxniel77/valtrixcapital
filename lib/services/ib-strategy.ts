import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  normalizeCommissionRatesBps,
  REFERRAL_LEVELS,
} from "@/lib/referrals/constants";

export interface IbStrategyDto {
  id: string;
  name: string;
  description: string;
  passiveBonusBps: number;
  tradeBonusExtraBps: number;
  /** null = use global platform rates when this user is upline */
  commissionRatesBps: number[] | null;
  isActive: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IbYieldBoost {
  passiveBonusBps: number;
  tradeBonusExtraBps: number;
  strategyId: string | null;
  strategyName: string | null;
}

const EMPTY_BOOST: IbYieldBoost = {
  passiveBonusBps: 0,
  tradeBonusExtraBps: 0,
  strategyId: null,
  strategyName: null,
};

function parseCommissionRates(raw: unknown): number[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const nums = raw.map((v) => Number(v));
  if (nums.length === 0) return null;
  return normalizeCommissionRatesBps(nums).slice(0, REFERRAL_LEVELS);
}

export function serializeIbStrategy(
  row: {
    id: string;
    name: string;
    description: string;
    passiveBonusBps: number;
    tradeBonusExtraBps: number;
    commissionRatesBps: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count?: { users: number };
  },
): IbStrategyDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    passiveBonusBps: row.passiveBonusBps,
    tradeBonusExtraBps: row.tradeBonusExtraBps,
    commissionRatesBps: parseCommissionRates(row.commissionRatesBps),
    isActive: row.isActive,
    userCount: row._count?.users ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Active IB boost for a user (0 if none / inactive). Cap still enforced separately. */
export async function getUserIbYieldBoost(
  userId: string,
): Promise<IbYieldBoost> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ibStrategyId: true,
      ibStrategy: {
        select: {
          id: true,
          name: true,
          isActive: true,
          passiveBonusBps: true,
          tradeBonusExtraBps: true,
        },
      },
    },
  });
  if (!user?.ibStrategy || !user.ibStrategy.isActive) return EMPTY_BOOST;
  return {
    passiveBonusBps: Math.max(0, user.ibStrategy.passiveBonusBps),
    tradeBonusExtraBps: Math.max(0, user.ibStrategy.tradeBonusExtraBps),
    strategyId: user.ibStrategy.id,
    strategyName: user.ibStrategy.name,
  };
}

/** Custom commission rates when this beneficiary is an IB; null = platform defaults. */
export async function getIbCommissionRatesForBeneficiary(
  beneficiaryId: string,
): Promise<number[] | null> {
  const user = await prisma.user.findUnique({
    where: { id: beneficiaryId },
    select: {
      ibStrategy: {
        select: { isActive: true, commissionRatesBps: true },
      },
    },
  });
  if (!user?.ibStrategy?.isActive) return null;
  return parseCommissionRates(user.ibStrategy.commissionRatesBps);
}

export async function listIbStrategies(): Promise<IbStrategyDto[]> {
  const rows = await prisma.ibStrategy.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  });
  return rows.map(serializeIbStrategy);
}

export class IbStrategyServiceError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_FOUND"
      | "INVALID"
      | "FORBIDDEN" = "INVALID",
  ) {
    super(message);
    this.name = "IbStrategyServiceError";
  }
}

export async function createIbStrategy(input: {
  adminUserId: string;
  name: string;
  description?: string;
  passiveBonusBps?: number;
  tradeBonusExtraBps?: number;
  commissionRatesBps?: number[] | null;
  isActive?: boolean;
}): Promise<IbStrategyDto> {
  const name = input.name.trim();
  if (!name) throw new IbStrategyServiceError("Name is required", "INVALID");

  const passiveBonusBps = Math.max(0, Math.round(input.passiveBonusBps ?? 0));
  const tradeBonusExtraBps = Math.max(
    0,
    Math.round(input.tradeBonusExtraBps ?? 0),
  );
  const commissionRatesBps =
    input.commissionRatesBps == null
      ? null
      : normalizeCommissionRatesBps(input.commissionRatesBps);

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.ibStrategy.create({
      data: {
        name,
        description: (input.description ?? "").trim(),
        passiveBonusBps,
        tradeBonusExtraBps,
        commissionRatesBps:
          commissionRatesBps === null
            ? Prisma.JsonNull
            : commissionRatesBps,
        isActive: input.isActive ?? true,
      },
      include: { _count: { select: { users: true } } },
    });
    await tx.adminAction.create({
      data: {
        adminId: input.adminUserId,
        action: "CREATE_IB_STRATEGY",
        payload: {
          strategyId: created.id,
          name: created.name,
          passiveBonusBps,
          tradeBonusExtraBps,
          commissionRatesBps,
        },
      },
    });
    return created;
  });

  return serializeIbStrategy(row);
}

export async function updateIbStrategy(input: {
  adminUserId: string;
  strategyId: string;
  name?: string;
  description?: string;
  passiveBonusBps?: number;
  tradeBonusExtraBps?: number;
  commissionRatesBps?: number[] | null;
  isActive?: boolean;
}): Promise<IbStrategyDto> {
  const existing = await prisma.ibStrategy.findUnique({
    where: { id: input.strategyId },
  });
  if (!existing) {
    throw new IbStrategyServiceError("Strategy not found", "NOT_FOUND");
  }

  const data: {
    name?: string;
    description?: string;
    passiveBonusBps?: number;
    tradeBonusExtraBps?: number;
    commissionRatesBps?: number[] | null;
    isActive?: boolean;
  } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new IbStrategyServiceError("Name is required", "INVALID");
    data.name = name;
  }
  if (input.description !== undefined) {
    data.description = input.description.trim();
  }
  if (input.passiveBonusBps !== undefined) {
    data.passiveBonusBps = Math.max(0, Math.round(input.passiveBonusBps));
  }
  if (input.tradeBonusExtraBps !== undefined) {
    data.tradeBonusExtraBps = Math.max(0, Math.round(input.tradeBonusExtraBps));
  }
  if (input.commissionRatesBps !== undefined) {
    data.commissionRatesBps =
      input.commissionRatesBps == null
        ? null
        : normalizeCommissionRatesBps(input.commissionRatesBps);
  }
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.ibStrategy.update({
      where: { id: input.strategyId },
      data: {
        name: data.name,
        description: data.description,
        passiveBonusBps: data.passiveBonusBps,
        tradeBonusExtraBps: data.tradeBonusExtraBps,
        isActive: data.isActive,
        ...(data.commissionRatesBps !== undefined
          ? {
              commissionRatesBps:
                data.commissionRatesBps === null
                  ? Prisma.JsonNull
                  : data.commissionRatesBps,
            }
          : {}),
      },
      include: { _count: { select: { users: true } } },
    });
    await tx.adminAction.create({
      data: {
        adminId: input.adminUserId,
        action: "UPDATE_IB_STRATEGY",
        payload: { strategyId: updated.id, ...data },
      },
    });
    return updated;
  });

  return serializeIbStrategy(row);
}

export async function assignIbStrategy(input: {
  adminUserId: string;
  targetUserId: string;
  strategyId: string | null;
}): Promise<{
  userId: string;
  ibStrategyId: string | null;
  ibStrategy: IbStrategyDto | null;
}> {
  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, ibStrategyId: true },
  });
  if (!target) {
    throw new IbStrategyServiceError("User not found", "NOT_FOUND");
  }

  let strategy: IbStrategyDto | null = null;
  if (input.strategyId) {
    const row = await prisma.ibStrategy.findUnique({
      where: { id: input.strategyId },
      include: { _count: { select: { users: true } } },
    });
    if (!row) {
      throw new IbStrategyServiceError("Strategy not found", "NOT_FOUND");
    }
    if (!row.isActive) {
      throw new IbStrategyServiceError(
        "Cannot assign an inactive strategy",
        "FORBIDDEN",
      );
    }
    strategy = serializeIbStrategy(row);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { ibStrategyId: input.strategyId },
    });
    await tx.adminAction.create({
      data: {
        adminId: input.adminUserId,
        targetUserId: target.id,
        action: "ASSIGN_IB_STRATEGY",
        payload: {
          previousStrategyId: target.ibStrategyId,
          nextStrategyId: input.strategyId,
          strategyName: strategy?.name ?? null,
        },
      },
    });
  });

  return {
    userId: target.id,
    ibStrategyId: input.strategyId,
    ibStrategy: strategy,
  };
}
