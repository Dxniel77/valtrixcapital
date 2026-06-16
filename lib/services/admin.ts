import type { AdminActionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findUserById, serializeUser, type BalanceAdjustmentTarget, type UserDto } from "@/lib/services/users";
import { refreshUserPayoutCap } from "@/lib/services/stakes";
import { fromMicro, toMicro } from "@/lib/utils";

export class AdminServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INVALID_DELTA"
      | "INSUFFICIENT_BALANCE"
      | "FORBIDDEN",
  ) {
    super(message);
    this.name = "AdminServiceError";
  }
}

export interface AdminMovementDto {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "YIELD" | "COMMISSION" | "ADJUSTMENT";
  wallet: string;
  amount: number;
  network: "BSC" | "POLYGON" | null;
  status: string;
  timestamp: number;
  note?: string;
}

export async function adjustUserBalance(input: {
  adminUserId: string;
  targetUserId: string;
  delta: number;
  note: string;
  target?: BalanceAdjustmentTarget;
}): Promise<UserDto> {
  const targetType = input.target ?? "WITHDRAWABLE";

  if (!Number.isFinite(input.delta) || input.delta === 0) {
    throw new AdminServiceError("Delta must be a non-zero number", "INVALID_DELTA");
  }

  const targetUser = await findUserById(input.targetUserId);
  if (!targetUser) {
    throw new AdminServiceError("User not found", "NOT_FOUND");
  }

  if (targetType === "STAKING") {
    if (input.delta <= 0) {
      throw new AdminServiceError(
        "Staking credits must be a positive amount",
        "INVALID_DELTA",
      );
    }

    const deltaMicro = toMicro(input.delta);

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetUser.id },
        data: { lockedCapital: { increment: deltaMicro } },
      });

      await tx.stake.create({
        data: {
          userId: targetUser.id,
          amount: deltaMicro,
          network: "BSC",
          status: "ACTIVE",
        },
      });

      await tx.adminAction.create({
        data: {
          adminId: input.adminUserId,
          targetUserId: targetUser.id,
          action: "ADJUST_BALANCE",
          payload: {
            delta: input.delta,
            note: input.note.trim(),
            target: targetType,
            previousLockedCapital: fromMicro(targetUser.lockedCapital),
            nextLockedCapital: fromMicro(user.lockedCapital),
          },
        },
      });

      return user;
    });

    await refreshUserPayoutCap(targetUser.id);
    const fresh = await findUserById(targetUser.id);
    return serializeUser(fresh ?? updated);
  }

  const deltaMicro = toMicro(input.delta);
  const nextBalance = targetUser.earningsBalance + deltaMicro;
  if (nextBalance < 0n) {
    throw new AdminServiceError("Insufficient balance", "INSUFFICIENT_BALANCE");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: targetUser.id },
      data: { earningsBalance: nextBalance },
    });

    await tx.adminAction.create({
      data: {
        adminId: input.adminUserId,
        targetUserId: targetUser.id,
        action: "ADJUST_BALANCE",
        payload: {
          delta: input.delta,
          note: input.note.trim(),
          target: targetType,
          previousBalance: fromMicro(targetUser.earningsBalance),
          nextBalance: fromMicro(nextBalance),
        },
      },
    });

    return user;
  });

  return serializeUser(updated);
}

export async function setUserActive(input: {
  adminUserId: string;
  targetUserId: string;
  isActive: boolean;
}): Promise<UserDto> {
  const target = await findUserById(input.targetUserId);
  if (!target) {
    throw new AdminServiceError("User not found", "NOT_FOUND");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: target.id },
      data: { isActive: input.isActive },
    });

    await tx.adminAction.create({
      data: {
        adminId: input.adminUserId,
        targetUserId: target.id,
        action: input.isActive ? "ACTIVATE" : "DEACTIVATE",
        payload: {},
      },
    });

    return user;
  });

  return serializeUser(updated);
}

export async function listAdminMovements(limit = 500): Promise<AdminMovementDto[]> {
  const [deposits, withdrawals, yields, commissions, adjustments] =
    await Promise.all([
      prisma.deposit.findMany({
        orderBy: { detectedAt: "desc" },
        take: limit,
        include: { user: { select: { walletAddress: true } } },
      }),
      prisma.withdrawal.findMany({
        orderBy: { requestedAt: "desc" },
        take: limit,
        include: { user: { select: { walletAddress: true } } },
      }),
      prisma.dailyYieldRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { user: { select: { walletAddress: true } } },
      }),
      prisma.commission.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          beneficiary: { select: { walletAddress: true } },
        },
      }),
      prisma.adminAction.findMany({
        where: { action: "ADJUST_BALANCE" },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          target: { select: { walletAddress: true } },
        },
      }),
    ]);

  const rows: AdminMovementDto[] = [];

  for (const d of deposits) {
    rows.push({
      id: `dep_${d.id}`,
      type: "DEPOSIT",
      wallet: d.user.walletAddress,
      amount: fromMicro(d.amount),
      network: d.network,
      status: d.status,
      timestamp: d.detectedAt.getTime(),
    });
  }

  for (const w of withdrawals) {
    rows.push({
      id: `wd_${w.id}`,
      type: "WITHDRAWAL",
      wallet: w.user.walletAddress,
      amount: fromMicro(w.amount),
      network: w.network,
      status: w.status,
      timestamp: w.requestedAt.getTime(),
    });
  }

  for (const y of yields) {
    rows.push({
      id: `yld_${y.id}`,
      type: "YIELD",
      wallet: y.user.walletAddress,
      amount: fromMicro(y.creditedAmount),
      network: null,
      status: "COMPLETED",
      timestamp: y.createdAt.getTime(),
    });
  }

  for (const c of commissions) {
    rows.push({
      id: `com_${c.id}`,
      type: "COMMISSION",
      wallet: c.beneficiary.walletAddress,
      amount: fromMicro(c.amount),
      network: null,
      status: "COMPLETED",
      timestamp: c.createdAt.getTime(),
    });
  }

  for (const a of adjustments) {
    const payload = a.payload as {
      delta?: number;
      note?: string;
      target?: BalanceAdjustmentTarget;
    };
    rows.push({
      id: `adj_${a.id}`,
      type: "ADJUSTMENT",
      wallet: a.target?.walletAddress ?? "",
      amount: payload.delta ?? 0,
      network: null,
      status: "COMPLETED",
      timestamp: a.createdAt.getTime(),
      note: payload.note,
    });
  }

  return rows.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export async function listAdminAudit(limit = 200) {
  const rows = await prisma.adminAction.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      admin: { select: { walletAddress: true, username: true } },
      target: { select: { walletAddress: true, username: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    payload: row.payload,
    actor: row.admin.walletAddress,
    target: row.target?.walletAddress ?? null,
    timestamp: row.createdAt.getTime(),
  }));
}

export function adminActionLabel(action: AdminActionType): string {
  switch (action) {
    case "ACTIVATE":
      return "USER_ACTIVATED";
    case "DEACTIVATE":
      return "USER_DEACTIVATED";
    case "ADJUST_BALANCE":
      return "BALANCE_ADJUSTED";
    case "APPROVE_WITHDRAWAL":
      return "WITHDRAWAL_APPROVED";
    case "REJECT_WITHDRAWAL":
      return "WITHDRAWAL_REJECTED";
    case "UPDATE_CONFIG":
      return "SETTINGS_UPDATED";
    default:
      return action;
  }
}

export async function getAdminActorId(walletAddress: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    select: { id: true },
  });
  return user?.id ?? null;
}
