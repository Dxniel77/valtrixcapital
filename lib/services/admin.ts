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
  yieldKind?: "operational" | "passive";
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
          source: "COMPANY_SPONSORED",
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
    const nextAllowance =
      nextBalance < targetUser.withdrawalAllowance
        ? nextBalance
        : targetUser.withdrawalAllowance;
    const user = await tx.user.update({
      where: { id: targetUser.id },
      data: {
        earningsBalance: nextBalance,
        withdrawalAllowance: nextAllowance,
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
          previousBalance: fromMicro(targetUser.earningsBalance),
          nextBalance: fromMicro(nextBalance),
          previousAllowance: fromMicro(targetUser.withdrawalAllowance),
          nextAllowance: fromMicro(nextAllowance),
        },
      },
    });

    return user;
  });

  return serializeUser(updated);
}

/**
 * Admin releases a partial USDT amount for a volume-locked sponsored user.
 * Example: earnings 200 → release 20 → user may withdraw up to 20; rest stays locked.
 */
export async function releaseWithdrawalAllowance(input: {
  adminUserId: string;
  targetUserId: string;
  amount: number;
  note?: string;
}): Promise<UserDto> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AdminServiceError("Amount must be a positive number", "INVALID_DELTA");
  }

  const target = await findUserById(input.targetUserId);
  if (!target) {
    throw new AdminServiceError("User not found", "NOT_FOUND");
  }
  if (!target.accountGranted) {
    throw new AdminServiceError(
      "Partial release is only for sponsored accounts",
      "FORBIDDEN",
    );
  }
  if (target.withdrawalUnlocked) {
    throw new AdminServiceError(
      "Withdrawals are already fully unlocked for this user",
      "FORBIDDEN",
    );
  }

  const amountMicro = toMicro(input.amount);
  const remainingLocked =
    target.earningsBalance > target.withdrawalAllowance
      ? target.earningsBalance - target.withdrawalAllowance
      : 0n;
  if (remainingLocked <= 0n) {
    throw new AdminServiceError(
      "No locked earnings left to release",
      "INSUFFICIENT_BALANCE",
    );
  }
  if (amountMicro > remainingLocked) {
    throw new AdminServiceError(
      `Can only release up to ${fromMicro(remainingLocked)} USDT`,
      "INSUFFICIENT_BALANCE",
    );
  }

  const nextAllowance = target.withdrawalAllowance + amountMicro;

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: target.id },
      data: { withdrawalAllowance: nextAllowance },
    });

    await tx.adminAction.create({
      data: {
        adminId: input.adminUserId,
        targetUserId: target.id,
        action: "RELEASE_WITHDRAWAL_ALLOWANCE",
        payload: {
          amount: input.amount,
          note: input.note?.trim() || "",
          previousAllowance: fromMicro(target.withdrawalAllowance),
          nextAllowance: fromMicro(nextAllowance),
          earningsBalance: fromMicro(target.earningsBalance),
        },
      },
    });

    return user;
  });

  return serializeUser(updated);
}

/**
 * Admin credits unlock progress (direct sales / L2 volume) without touching
 * earnings or active capital. Used to repair cases where a referral deposit
 * was registered as company-sponsored adjust instead of a real deposit.
 */
export async function creditUnlockVolume(input: {
  adminUserId: string;
  targetUserId: string;
  amount: number;
  level?: "direct" | "l2";
  note?: string;
}): Promise<UserDto> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AdminServiceError("Amount must be a positive number", "INVALID_DELTA");
  }

  const target = await findUserById(input.targetUserId);
  if (!target) {
    throw new AdminServiceError("User not found", "NOT_FOUND");
  }
  if (!target.accountGranted) {
    throw new AdminServiceError(
      "Unlock volume credit is only for sponsored accounts",
      "FORBIDDEN",
    );
  }

  const level = input.level ?? "direct";
  const amountMicro = toMicro(input.amount);
  const { creditUnlockVolumeForUser } = await import(
    "@/lib/services/unlock-volume"
  );

  await creditUnlockVolumeForUser({
    userId: target.id,
    amountMicro,
    level,
  });

  await prisma.adminAction.create({
    data: {
      adminId: input.adminUserId,
      targetUserId: target.id,
      action: "UPDATE_SPONSORSHIP",
      payload: {
        kind: "UNLOCK_VOLUME_CREDIT",
        amount: input.amount,
        level,
        note: input.note?.trim() || "",
        previousDirectSalesVolume: fromMicro(target.unlockDirectVolume),
      },
    },
  });

  const fresh = await findUserById(target.id);
  if (!fresh) {
    throw new AdminServiceError("User not found", "NOT_FOUND");
  }
  return serializeUser(fresh);
}

/**
 * Admin marks an amount as already paid outside the app (e.g. SafePal/treasury send).
 * Debits earnings and matching withdrawal allowance so the user cannot withdraw again.
 */
export async function reconcileManualPayout(input: {
  adminUserId: string;
  targetUserId: string;
  amount: number;
  note?: string;
}): Promise<UserDto> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AdminServiceError("Amount must be a positive number", "INVALID_DELTA");
  }

  const target = await findUserById(input.targetUserId);
  if (!target) {
    throw new AdminServiceError("User not found", "NOT_FOUND");
  }

  const amountMicro = toMicro(input.amount);
  if (target.earningsBalance < amountMicro) {
    throw new AdminServiceError("Insufficient balance", "INSUFFICIENT_BALANCE");
  }

  const nextBalance = target.earningsBalance - amountMicro;
  // Reduce released allowance by the paid amount (cannot go below 0 or above new balance).
  let nextAllowance = target.withdrawalAllowance - amountMicro;
  if (nextAllowance < 0n) nextAllowance = 0n;
  if (nextAllowance > nextBalance) nextAllowance = nextBalance;

  const note =
    input.note?.trim() ||
    "Manual payout reconciled — USDT sent outside the app";

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: target.id },
      data: {
        earningsBalance: nextBalance,
        withdrawalAllowance: nextAllowance,
      },
    });

    await tx.adminAction.create({
      data: {
        adminId: input.adminUserId,
        targetUserId: target.id,
        action: "ADJUST_BALANCE",
        payload: {
          delta: -input.amount,
          note,
          target: "WITHDRAWABLE",
          manualPayout: true,
          previousBalance: fromMicro(target.earningsBalance),
          nextBalance: fromMicro(nextBalance),
          previousAllowance: fromMicro(target.withdrawalAllowance),
          nextAllowance: fromMicro(nextAllowance),
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
  const [deposits, withdrawals, yields, commissions, adjustments, treasuryDeposits, treasuryWithdrawals, tradeBonuses] =
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
      prisma.treasuryDeposit.findMany({
        orderBy: { startedAt: "desc" },
        take: limit,
      }),
      prisma.treasuryWithdrawal.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          userWithdrawal: {
            include: { user: { select: { walletAddress: true } } },
          },
        },
      }),
      prisma.trade.findMany({
        where: { result: "WIN", bonusCredited: { gt: 0n }, resolvedAt: { not: null } },
        orderBy: { resolvedAt: "desc" },
        take: limit,
        include: { user: { select: { walletAddress: true } } },
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
      timestamp: (d.confirmedAt ?? d.detectedAt).getTime(),
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
      yieldKind: "passive",
    });
  }

  for (const t of tradeBonuses) {
    if (!t.resolvedAt) continue;
    rows.push({
      id: `trd_${t.id}`,
      type: "YIELD",
      wallet: t.user.walletAddress,
      amount: fromMicro(t.bonusCredited),
      network: null,
      status: "COMPLETED",
      timestamp: t.resolvedAt.getTime(),
      yieldKind: "operational",
      note: `Trade win bonus · ${t.pair}`,
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

  for (const d of treasuryDeposits) {
    rows.push({
      id: `tdep_${d.id}`,
      type: "DEPOSIT",
      wallet: "treasury",
      amount: fromMicro(d.amount),
      network: d.network,
      status: d.status,
      timestamp: (d.confirmedAt ?? d.startedAt).getTime(),
      note: `Treasury inflow · ${d.txHash}`,
    });
  }

  for (const w of treasuryWithdrawals) {
    if (w.kind === "USER_PAYOUT") continue;

    rows.push({
      id: `twd_${w.id}`,
      type: "WITHDRAWAL",
      wallet: "treasury",
      amount: fromMicro(w.amount),
      network: w.network,
      status: "COMPLETED",
      timestamp: w.createdAt.getTime(),
      note: w.note || "Treasury outflow",
    });
  }

  return rows.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export async function listAdminAudit(limit = 200) {
  const rows = await prisma.adminAction.findMany({
    where: {
      NOT: {
        AND: [
          {
            payload: {
              path: ["kind"],
              equals: "COPY_PERFORMANCE",
            },
          },
          {
            payload: {
              path: ["source"],
              equals: "SIMULATION",
            },
          },
        ],
      },
    },
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
    case "UPDATE_USER_PROFILE":
      return "USER_PROFILE_UPDATED";
    case "UPDATE_SPONSORSHIP":
      return "SPONSORSHIP_UPDATED";
    case "UPDATE_SPONSOR_TERMS":
      return "SPONSOR_TERMS_UPDATED";
    case "PROCESS_ACCOUNT_DELETION":
      return "ACCOUNT_DELETION_PROCESSED";
    case "CREATE_IB_STRATEGY":
      return "IB_STRATEGY_CREATED";
    case "UPDATE_IB_STRATEGY":
      return "IB_STRATEGY_UPDATED";
    case "ASSIGN_IB_STRATEGY":
      return "IB_STRATEGY_ASSIGNED";
    case "UPSERT_IB_AGREEMENT":
      return "IB_AGREEMENT_UPDATED";
    case "IB_NET_DEPOSIT_CREDIT":
      return "IB_NET_DEPOSIT_CREDITED";
    case "RELEASE_WITHDRAWAL_ALLOWANCE":
      return "WITHDRAWAL_ALLOWANCE_RELEASED";
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

/** First seeded admin user id from `ADMIN_WALLETS` (for system audit entries). */
export async function getDefaultAdminActorId(): Promise<string | null> {
  const wallets = (process.env.ADMIN_WALLETS ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
  for (const wallet of wallets) {
    const id = await getAdminActorId(wallet);
    if (id) return id;
  }

  // Fallback: any ADMIN role user (covers misconfigured ADMIN_WALLETS).
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id ?? null;
}
