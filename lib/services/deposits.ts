import type { Network } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fromMicro, toMicro } from "@/lib/utils";
import { refreshUserPayoutCap } from "@/lib/services/stakes";
import { REQUIRED_CONFIRMATIONS } from "@/lib/staking/constants";

export class DepositServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INVALID_AMOUNT"
      | "DUPLICATE_TX"
      | "FORBIDDEN"
      | "NOT_READY",
  ) {
    super(message);
    this.name = "DepositServiceError";
  }
}

export interface DepositDto {
  id: string;
  network: Network;
  amount: number;
  fromAddress: string;
  toAddress: string;
  txHash: string;
  confirmations: number;
  status: string;
  detectedAt: string;
  confirmedAt: string | null;
  stakeId: string | null;
}

function serializeDeposit(d: {
  id: string;
  network: Network;
  amount: bigint;
  fromAddress: string;
  toAddress: string;
  txHash: string;
  confirmations: number;
  status: string;
  detectedAt: Date;
  confirmedAt: Date | null;
  stake?: { id: string } | null;
}): DepositDto {
  return {
    id: d.id,
    network: d.network,
    amount: fromMicro(d.amount),
    fromAddress: d.fromAddress,
    toAddress: d.toAddress,
    txHash: d.txHash,
    confirmations: d.confirmations,
    status: d.status,
    detectedAt: d.detectedAt.toISOString(),
    confirmedAt: d.confirmedAt?.toISOString() ?? null,
    stakeId: d.stake?.id ?? null,
  };
}

export async function registerDeposit(input: {
  userId: string;
  network: Network;
  amount: number;
  fromAddress: string;
  toAddress: string;
  txHash: string;
}): Promise<DepositDto> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new DepositServiceError("Invalid amount", "INVALID_AMOUNT");
  }

  const existingTx = await prisma.deposit.findUnique({
    where: { txHash: input.txHash.toLowerCase() },
  });
  if (existingTx) {
    throw new DepositServiceError("Transaction already registered", "DUPLICATE_TX");
  }

  const created = await prisma.deposit.create({
    data: {
      userId: input.userId,
      network: input.network,
      amount: toMicro(input.amount),
      fromAddress: input.fromAddress.toLowerCase(),
      toAddress: input.toAddress.toLowerCase(),
      txHash: input.txHash.toLowerCase(),
      status: "PENDING",
    },
  });

  return serializeDeposit(created);
}

export async function advanceDepositConfirmations(
  depositId: string,
  userId: string,
): Promise<DepositDto> {
  const deposit = await prisma.deposit.findFirst({
    where: { id: depositId, userId },
    include: { stake: { select: { id: true } } },
  });
  if (!deposit) throw new DepositServiceError("Deposit not found", "NOT_FOUND");
  if (deposit.status !== "PENDING") return serializeDeposit(deposit);

  const next = Math.min(deposit.confirmations + 1, REQUIRED_CONFIRMATIONS);
  const updated = await prisma.deposit.update({
    where: { id: deposit.id },
    data: { confirmations: next },
    include: { stake: { select: { id: true } } },
  });
  return serializeDeposit(updated);
}

export async function confirmDepositForUser(
  depositId: string,
  userId: string,
): Promise<DepositDto> {
  const deposit = await prisma.deposit.findFirst({
    where: { id: depositId, userId },
    include: { stake: true },
  });
  if (!deposit) throw new DepositServiceError("Deposit not found", "NOT_FOUND");
  if (deposit.status === "CONFIRMED") return serializeDeposit(deposit);
  if (deposit.confirmations < REQUIRED_CONFIRMATIONS) {
    throw new DepositServiceError("Not enough confirmations", "NOT_READY");
  }
  return confirmDeposit(depositId);
}

export async function confirmDeposit(depositId: string): Promise<DepositDto> {
  const deposit = await prisma.deposit.findUnique({
    where: { id: depositId },
    include: { stake: true },
  });
  if (!deposit) throw new DepositServiceError("Deposit not found", "NOT_FOUND");

  const updated = await prisma.$transaction(async (tx) => {
    const confirmed = await tx.deposit.update({
      where: { id: deposit.id },
      data: {
        status: "CONFIRMED",
        confirmations: Math.max(deposit.confirmations, 12),
        confirmedAt: new Date(),
      },
    });

    let stake = deposit.stake;
    if (!stake) {
      stake = await tx.stake.create({
        data: {
          userId: deposit.userId,
          amount: deposit.amount,
          network: deposit.network,
          depositId: deposit.id,
          status: "ACTIVE",
        },
      });

      await tx.user.update({
        where: { id: deposit.userId },
        data: {
          lockedCapital: {
            increment: deposit.amount,
          },
        },
      });

      await refreshUserPayoutCap(deposit.userId);
    }

    return tx.deposit.findUniqueOrThrow({
      where: { id: confirmed.id },
      include: { stake: true },
    });
  });

  return serializeDeposit(updated);
}

export async function listUserDeposits(userId: string): Promise<DepositDto[]> {
  const rows = await prisma.deposit.findMany({
    where: { userId },
    orderBy: { detectedAt: "desc" },
    take: 200,
    include: { stake: { select: { id: true } } },
  });
  return rows.map(serializeDeposit);
}
