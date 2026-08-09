import type { Network } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPlatformConfig } from "@/lib/services/config";
import { fromMicro, toMicro } from "@/lib/utils";
import {
  assertTreasuryLiquidityForPayout,
  deductTreasuryForUserPayoutInTx,
  TreasuryServiceError,
} from "@/lib/services/treasury";
import {
  processAutomaticWithdrawalPayout,
  rejectWithdrawalAfterFailedPayout,
  WithdrawalPayoutError,
} from "@/lib/services/withdrawal-payout";

export class WithdrawalServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INVALID_AMOUNT"
      | "INSUFFICIENT_BALANCE"
      | "INACTIVE"
      | "INSUFFICIENT_TREASURY"
      | "PAYOUT_FAILED"
      | "WITHDRAWAL_LOCKED",
  ) {
    super(message);
    this.name = "WithdrawalServiceError";
  }
}

export interface WithdrawalDto {
  id: string;
  network: Network;
  amount: number;
  fee: number;
  netAmount: number;
  toAddress: string;
  status: string;
  txHash: string | null;
  requestedAt: string;
  processedAt: string | null;
}

function serializeWithdrawal(w: {
  id: string;
  network: Network;
  amount: bigint;
  fee: bigint;
  netAmount: bigint;
  toAddress: string;
  status: string;
  txHash: string | null;
  requestedAt: Date;
  processedAt: Date | null;
}): WithdrawalDto {
  return {
    id: w.id,
    network: w.network,
    amount: fromMicro(w.amount),
    fee: fromMicro(w.fee),
    netAmount: fromMicro(w.netAmount),
    toAddress: w.toAddress,
    status: w.status,
    txHash: w.txHash,
    requestedAt: w.requestedAt.toISOString(),
    processedAt: w.processedAt?.toISOString() ?? null,
  };
}

export async function createWithdrawal(input: {
  userId: string;
  network: Network;
  amount: number;
  feeBps: number;
  toAddress: string;
}): Promise<WithdrawalDto> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new WithdrawalServiceError("Invalid amount", "INVALID_AMOUNT");
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new WithdrawalServiceError("User not found", "NOT_FOUND");
  if (!user.isActive) throw new WithdrawalServiceError("Account inactive", "INACTIVE");

  const volumeLocked = user.accountGranted && !user.withdrawalUnlocked;
  if (volumeLocked && user.withdrawalAllowance <= 0n) {
    throw new WithdrawalServiceError(
      "Withdrawals locked until requirements are met",
      "WITHDRAWAL_LOCKED",
    );
  }

  const config = await getPlatformConfig();
  if (input.amount < config.minWithdrawal) {
    throw new WithdrawalServiceError(
      `Minimum withdrawal is ${config.minWithdrawal} USDT`,
      "INVALID_AMOUNT",
    );
  }

  const amountMicro = toMicro(input.amount);
  const feeMicro = (amountMicro * BigInt(input.feeBps)) / 10_000n;
  const netMicro = amountMicro - feeMicro;

  if (user.earningsBalance < amountMicro) {
    throw new WithdrawalServiceError("Insufficient balance", "INSUFFICIENT_BALANCE");
  }

  if (volumeLocked && user.withdrawalAllowance < amountMicro) {
    throw new WithdrawalServiceError(
      `Only ${fromMicro(user.withdrawalAllowance)} USDT has been released for withdrawal`,
      "WITHDRAWAL_LOCKED",
    );
  }

  const netAmount = fromMicro(netMicro);
  try {
    await assertTreasuryLiquidityForPayout(input.network, netAmount);
  } catch (err) {
    if (
      err instanceof TreasuryServiceError &&
      err.code === "INSUFFICIENT_FUNDS"
    ) {
      throw new WithdrawalServiceError(
        "Insufficient treasury liquidity for payout",
        "INSUFFICIENT_TREASURY",
      );
    }
    throw err;
  }

  /**
   * Debit balance (and allowance when volume-locked) with conditional updateMany
   * so concurrent requests cannot overdraw the released amount or earnings.
   */
  const created = await prisma.$transaction(async (tx) => {
    const debited = volumeLocked
      ? await tx.user.updateMany({
          where: {
            id: user.id,
            isActive: true,
            accountGranted: true,
            withdrawalUnlocked: false,
            earningsBalance: { gte: amountMicro },
            withdrawalAllowance: { gte: amountMicro },
          },
          data: {
            earningsBalance: { decrement: amountMicro },
            withdrawalAllowance: { decrement: amountMicro },
          },
        })
      : await tx.user.updateMany({
          where: {
            id: user.id,
            isActive: true,
            earningsBalance: { gte: amountMicro },
            // Still fully unlocked (or not a sponsored lock) at write time.
            NOT: {
              AND: [{ accountGranted: true }, { withdrawalUnlocked: false }],
            },
          },
          data: {
            earningsBalance: { decrement: amountMicro },
          },
        });

    if (debited.count !== 1) {
      const latest = await tx.user.findUnique({ where: { id: user.id } });
      if (!latest || latest.earningsBalance < amountMicro) {
        throw new WithdrawalServiceError(
          "Insufficient balance",
          "INSUFFICIENT_BALANCE",
        );
      }
      if (latest.accountGranted && !latest.withdrawalUnlocked) {
        if (latest.withdrawalAllowance <= 0n) {
          throw new WithdrawalServiceError(
            "Withdrawals locked until requirements are met",
            "WITHDRAWAL_LOCKED",
          );
        }
        throw new WithdrawalServiceError(
          `Only ${fromMicro(latest.withdrawalAllowance)} USDT has been released for withdrawal`,
          "WITHDRAWAL_LOCKED",
        );
      }
      throw new WithdrawalServiceError(
        "Withdrawals locked until requirements are met",
        "WITHDRAWAL_LOCKED",
      );
    }

    return tx.withdrawal.create({
      data: {
        userId: user.id,
        network: input.network,
        amount: amountMicro,
        fee: feeMicro,
        netAmount: netMicro,
        toAddress: input.toAddress.toLowerCase(),
        status: "REQUESTED",
      },
    });
  });

  try {
    await processAutomaticWithdrawalPayout(created.id);
  } catch (err) {
    // On-chain USDT already left — keep debit; return SENT row for ops to confirm.
    if (
      err instanceof WithdrawalPayoutError &&
      err.code === "PAYOUT_SENT_UNCONFIRMED"
    ) {
      const sent = await prisma.withdrawal.findUniqueOrThrow({
        where: { id: created.id },
      });
      return serializeWithdrawal(sent);
    }
    await rejectWithdrawalAfterFailedPayout(created.id);
    if (err instanceof WithdrawalPayoutError) {
      if (err.code === "INSUFFICIENT_TREASURY") {
        throw new WithdrawalServiceError(err.message, "INSUFFICIENT_TREASURY");
      }
      throw new WithdrawalServiceError(err.message, "PAYOUT_FAILED");
    }
    throw new WithdrawalServiceError(
      err instanceof Error ? err.message : "Automatic payout failed",
      "PAYOUT_FAILED",
    );
  }

  const confirmed = await prisma.withdrawal.findUniqueOrThrow({
    where: { id: created.id },
  });
  return serializeWithdrawal(confirmed);
}

export async function listUserWithdrawals(userId: string): Promise<WithdrawalDto[]> {
  const rows = await prisma.withdrawal.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
    take: 200,
  });
  return rows.map(serializeWithdrawal);
}

export async function listPendingWithdrawals(): Promise<
  (WithdrawalDto & { walletAddress: string })[]
> {
  const rows = await prisma.withdrawal.findMany({
    where: { status: { in: ["REQUESTED", "APPROVED", "SENT"] } },
    orderBy: { requestedAt: "desc" },
    take: 200,
    include: { user: { select: { walletAddress: true } } },
  });

  return rows.map((row) => ({
    ...serializeWithdrawal(row),
    walletAddress: row.user.walletAddress,
  }));
}

export async function updateWithdrawalStatus(input: {
  adminUserId: string;
  withdrawalId: string;
  status: "APPROVED" | "REJECTED" | "SENT" | "CONFIRMED";
  txHash?: string;
}): Promise<WithdrawalDto> {
  const existing = await prisma.withdrawal.findUnique({
    where: { id: input.withdrawalId },
    include: { user: true },
  });
  if (!existing) {
    throw new WithdrawalServiceError("Withdrawal not found", "NOT_FOUND");
  }

  if (input.status === "CONFIRMED") {
    const payoutHash = input.txHash?.trim() || existing.txHash?.trim();
    if (!payoutHash) {
      throw new WithdrawalServiceError(
        "Transaction hash required to confirm payout",
        "INVALID_AMOUNT",
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.withdrawal.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        txHash: input.txHash?.trim() || existing.txHash,
        processedAt:
          input.status === "CONFIRMED" || input.status === "REJECTED"
            ? new Date()
            : existing.processedAt,
      },
    });

    if (input.status === "REJECTED") {
      const restoreAllowance =
        existing.user.accountGranted && !existing.user.withdrawalUnlocked;
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          earningsBalance: { increment: existing.amount },
          ...(restoreAllowance
            ? { withdrawalAllowance: { increment: existing.amount } }
            : {}),
        },
      });
    }

    if (input.status === "CONFIRMED") {
      try {
        await deductTreasuryForUserPayoutInTx(tx, {
          userWithdrawalId: existing.id,
          network: existing.network,
          netAmount: fromMicro(existing.netAmount),
          toAddress: existing.toAddress,
          txHash: input.txHash ?? existing.txHash,
          createdBy: input.adminUserId,
        });
      } catch (err) {
        if (
          err instanceof TreasuryServiceError &&
          err.code === "INSUFFICIENT_FUNDS"
        ) {
          throw new WithdrawalServiceError(
            "Insufficient treasury liquidity for payout",
            "INSUFFICIENT_TREASURY",
          );
        }
        throw err;
      }
    }

    await tx.adminAction.create({
      data: {
        adminId: input.adminUserId,
        targetUserId: existing.userId,
        action:
          input.status === "REJECTED" ? "REJECT_WITHDRAWAL" : "APPROVE_WITHDRAWAL",
        payload: {
          withdrawalId: existing.id,
          status: input.status,
          txHash:
            input.txHash?.trim() || existing.txHash?.trim() || null,
        },
      },
    });

    return row;
  });

  return serializeWithdrawal(updated);
}
