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
  treasuryPoolFromWithdrawalSource,
  TreasuryServiceError,
} from "@/lib/services/treasury";

export class WithdrawalPayoutError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INVALID_STATE"
      | "INSUFFICIENT_TREASURY"
      | "PAYOUT_FAILED"
      /** On-chain send succeeded; DB confirm/treasury bookkeeping failed. Never refund. */
      | "PAYOUT_SENT_UNCONFIRMED",
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
      pool: treasuryPoolFromWithdrawalSource(
        "source" in existing && existing.source === "COPY_CASH"
          ? "COPY_CASH"
          : "EARNINGS",
      ),
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
  // Money may already have left the treasury — never credit the user again.
  if (existing.txHash?.trim()) return;

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
    const source =
      "source" in existing && existing.source === "COPY_CASH" ? "COPY_CASH" : "EARNINGS";
    const restoreAllowance = Boolean(
      source !== "COPY_CASH" &&
        user?.accountGranted &&
        !user.withdrawalUnlocked,
    );
    const pocket =
      source === "COPY_CASH"
        ? { copyCashBalance: { increment: existing.amount } }
        : { earningsBalance: { increment: existing.amount } };
    await tx.user.update({
      where: { id: existing.userId },
      data: {
        ...pocket,
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

  // Prior send already recorded — only retry DB/treasury confirmation.
  const priorHash = existing.txHash?.trim();
  if (priorHash) {
    try {
      await confirmWithdrawalAfterPayout({
        withdrawalId: existing.id,
        txHash: priorHash,
      });
      return { txHash: priorHash };
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : "Confirmation failed";
      throw new WithdrawalPayoutError(
        `Payout already sent on-chain (${priorHash}) but confirmation failed: ${detail}`,
        "PAYOUT_SENT_UNCONFIRMED",
      );
    }
  }

  const netAmount = fromMicro(existing.netAmount);
  let txHash: string;
  try {
    txHash = await executeAutomaticUsdtPayout({
      network: existing.network as Network,
      toAddress: existing.toAddress,
      netAmount,
      pool: treasuryPoolFromWithdrawalSource(
        "source" in existing && existing.source === "COPY_CASH"
          ? "COPY_CASH"
          : "EARNINGS",
      ),
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

  // Persist hash before confirm so a later failure never triggers a balance refund.
  await prisma.withdrawal.update({
    where: { id: existing.id },
    data: { status: "SENT", txHash },
  });

  try {
    await confirmWithdrawalAfterPayout({
      withdrawalId: existing.id,
      txHash,
    });
  } catch (err) {
    const detail =
      err instanceof TreasuryServiceError && err.code === "INSUFFICIENT_FUNDS"
        ? "Insufficient treasury liquidity for payout"
        : err instanceof Error
          ? err.message
          : "Confirmation failed";
    throw new WithdrawalPayoutError(
      `Payout sent on-chain (${txHash}) but confirmation failed: ${detail}`,
      "PAYOUT_SENT_UNCONFIRMED",
    );
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
