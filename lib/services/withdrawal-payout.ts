import type { Network } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fromMicro } from "@/lib/utils";
import { getDefaultAdminActorId } from "@/lib/services/admin";
import {
  AutomaticPayoutError,
  executeAutomaticUsdtPayout,
} from "@/lib/services/automatic-payout";
import {
  deductTreasuryForUserPayoutInTx,
  TreasuryServiceError,
} from "@/lib/services/treasury";

export class WithdrawalPayoutError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INVALID_STATE"
      | "INSUFFICIENT_TREASURY"
      | "PAYOUT_FAILED",
  ) {
    super(message);
    this.name = "WithdrawalPayoutError";
  }
}

/** Confirms a withdrawal after a successful on-chain USDT payout. */
export async function confirmWithdrawalAfterPayout(input: {
  withdrawalId: string;
  txHash: string;
  createdBy?: string;
}): Promise<void> {
  const existing = await prisma.withdrawal.findUnique({
    where: { id: input.withdrawalId },
  });
  if (!existing) {
    throw new WithdrawalPayoutError("Withdrawal not found", "NOT_FOUND");
  }
  if (existing.status === "CONFIRMED") return;
  if (existing.status === "REJECTED") {
    throw new WithdrawalPayoutError("Withdrawal was rejected", "INVALID_STATE");
  }

  await prisma.$transaction(async (tx) => {
    await tx.withdrawal.update({
      where: { id: existing.id },
      data: {
        status: "CONFIRMED",
        txHash: input.txHash,
        processedAt: new Date(),
      },
    });

    await deductTreasuryForUserPayoutInTx(tx, {
      userWithdrawalId: existing.id,
      network: existing.network,
      netAmount: fromMicro(existing.netAmount),
      toAddress: existing.toAddress,
      txHash: input.txHash,
    });
  });

  const adminId = await getDefaultAdminActorId();
  if (adminId) {
    await prisma.adminAction.create({
      data: {
        adminId,
        targetUserId: existing.userId,
        action: "APPROVE_WITHDRAWAL",
        payload: {
          withdrawalId: existing.id,
          status: "CONFIRMED",
          txHash: input.txHash,
          automatic: true,
        },
      },
    });
  }
}

/** Refunds a failed automatic payout back to the user's withdrawable balance. */
export async function rejectWithdrawalAfterFailedPayout(
  withdrawalId: string,
): Promise<void> {
  const existing = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
  });
  if (!existing) return;
  if (existing.status === "CONFIRMED" || existing.status === "REJECTED") return;

  await prisma.$transaction(async (tx) => {
    await tx.withdrawal.update({
      where: { id: existing.id },
      data: {
        status: "REJECTED",
        processedAt: new Date(),
      },
    });
    const user = await tx.user.findUnique({
      where: { id: existing.userId },
      select: {
        accountGranted: true,
        withdrawalUnlocked: true,
      },
    });
    const restoreAllowance = Boolean(
      user?.accountGranted && !user.withdrawalUnlocked,
    );
    await tx.user.update({
      where: { id: existing.userId },
      data: {
        earningsBalance: { increment: existing.amount },
        ...(restoreAllowance
          ? { withdrawalAllowance: { increment: existing.amount } }
          : {}),
      },
    });
  });
}

/** Sends USDT on-chain and marks the withdrawal CONFIRMED. */
export async function processAutomaticWithdrawalPayout(
  withdrawalId: string,
): Promise<{ txHash: string }> {
  const existing = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
  });
  if (!existing) {
    throw new WithdrawalPayoutError("Withdrawal not found", "NOT_FOUND");
  }
  if (existing.status === "CONFIRMED" && existing.txHash) {
    return { txHash: existing.txHash };
  }
  if (existing.status === "REJECTED") {
    throw new WithdrawalPayoutError("Withdrawal was rejected", "INVALID_STATE");
  }

  const netAmount = fromMicro(existing.netAmount);
  let txHash: string;
  try {
    txHash = await executeAutomaticUsdtPayout({
      network: existing.network as Network,
      toAddress: existing.toAddress,
      netAmount,
    });
  } catch (err) {
    const message =
      err instanceof AutomaticPayoutError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Automatic payout failed";
    throw new WithdrawalPayoutError(message, "PAYOUT_FAILED");
  }

  try {
    await confirmWithdrawalAfterPayout({
      withdrawalId: existing.id,
      txHash,
    });
  } catch (err) {
    if (
      err instanceof TreasuryServiceError &&
      err.code === "INSUFFICIENT_FUNDS"
    ) {
      throw new WithdrawalPayoutError(
        "Insufficient treasury liquidity for payout",
        "INSUFFICIENT_TREASURY",
      );
    }
    throw err;
  }

  return { txHash };
}

/** Retries automatic payout for withdrawals still awaiting on-chain settlement. */
export async function processPendingAutomaticWithdrawals(limit = 20): Promise<{
  processed: number;
  failed: number;
}> {
  const rows = await prisma.withdrawal.findMany({
    where: {
      status: { in: ["REQUESTED", "APPROVED", "SENT"] },
      txHash: null,
    },
    orderBy: { requestedAt: "asc" },
    take: limit,
  });

  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await processAutomaticWithdrawalPayout(row.id);
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed, failed };
}
