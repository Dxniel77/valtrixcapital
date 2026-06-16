import type { Network } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fromMicro, toMicro } from "@/lib/utils";

export class WithdrawalServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INVALID_AMOUNT"
      | "INSUFFICIENT_BALANCE"
      | "INACTIVE",
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

  const amountMicro = toMicro(input.amount);
  const feeMicro = (amountMicro * BigInt(input.feeBps)) / 10_000n;
  const netMicro = amountMicro - feeMicro;

  if (user.earningsBalance < amountMicro) {
    throw new WithdrawalServiceError("Insufficient balance", "INSUFFICIENT_BALANCE");
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { earningsBalance: user.earningsBalance - amountMicro },
    });

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

  return serializeWithdrawal(created);
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

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.withdrawal.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        txHash: input.txHash ?? existing.txHash,
        processedAt:
          input.status === "CONFIRMED" || input.status === "REJECTED"
            ? new Date()
            : existing.processedAt,
      },
    });

    if (input.status === "REJECTED") {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          earningsBalance: existing.user.earningsBalance + existing.amount,
        },
      });
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
          txHash: input.txHash ?? null,
        },
      },
    });

    return row;
  });

  return serializeWithdrawal(updated);
}
