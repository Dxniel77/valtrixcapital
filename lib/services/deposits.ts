import type { Network } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeWallet } from "@/lib/auth/admins";
import { fromMicro, toMicro } from "@/lib/utils";
import { refreshUserPayoutCap } from "@/lib/services/stakes";
import {
  evaluateAndPersistWithdrawalUnlock,
  propagateRealDepositVolume,
} from "@/lib/services/unlock-volume";
import { creditIbNetDepositForDeposit } from "@/lib/services/ib-net-deposit";
import { getPlatformConfig } from "@/lib/services/config";
import {
  getTxConfirmationCount,
  getTxOutcome,
  verifyUsdtDepositTx,
  type VerifiedUsdtDeposit,
} from "@/lib/services/deposit-verification";
import { isProductionRuntime } from "@/lib/runtime-mode";
import { REQUIRED_CONFIRMATIONS } from "@/lib/staking/constants";
import type { StakingNetwork } from "@/lib/staking/store";

export class DepositServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INVALID_AMOUNT"
      | "DUPLICATE_TX"
      | "FORBIDDEN"
      | "NOT_READY"
      | "TX_NOT_VERIFIED"
      | "TX_OWNED_BY_OTHER"
      | "TX_REVERTED",
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

async function resolveVerifiedDepositInput(input: {
  network: Network;
  amount: number;
  fromAddress: string;
  toAddress: string;
  txHash: string;
}): Promise<{
  amount: number;
  fromAddress: string;
  toAddress: string;
  txHash: string;
}> {
  const normalized = {
    amount: input.amount,
    fromAddress: normalizeWallet(input.fromAddress),
    toAddress: normalizeWallet(input.toAddress),
    txHash: input.txHash.toLowerCase(),
  };

  // Registration records intent; on-chain verification runs at claim/confirm.
  return normalized;
}

async function syncOnChainConfirmations(deposit: {
  id: string;
  network: Network;
  txHash: string;
  confirmations: number;
}): Promise<number> {
  if (!isProductionRuntime()) {
    return Math.min(deposit.confirmations + 1, REQUIRED_CONFIRMATIONS);
  }

  const onChain = await getTxConfirmationCount(
    deposit.network as StakingNetwork,
    deposit.txHash,
  );
  return Math.min(Math.max(onChain, deposit.confirmations), REQUIRED_CONFIRMATIONS);
}

async function assertDepositReadyForConfirm(deposit: {
  network: Network;
  txHash: string;
  fromAddress: string;
}): Promise<VerifiedUsdtDeposit> {
  if (!isProductionRuntime()) return {
    amount: 0,
    fromAddress: deposit.fromAddress,
    toAddress: "",
  };

  const verified = await verifyUsdtDepositTx({
    network: deposit.network as StakingNetwork,
    txHash: deposit.txHash,
    expectedFrom: deposit.fromAddress,
    waitForMining: true,
  });
  if (!verified) {
    throw new DepositServiceError(
      "Could not verify USDT transfer to treasury",
      "TX_NOT_VERIFIED",
    );
  }

  const confirmations = await getTxConfirmationCount(
    deposit.network as StakingNetwork,
    deposit.txHash,
  );
  if (confirmations < REQUIRED_CONFIRMATIONS) {
    throw new DepositServiceError("Not enough confirmations", "NOT_READY");
  }

  return verified;
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

  const verifiedInput = await resolveVerifiedDepositInput(input);

  const existingTx = await prisma.deposit.findUnique({
    where: { txHash: verifiedInput.txHash },
  });
  if (existingTx) {
    throw new DepositServiceError("Transaction already registered", "DUPLICATE_TX");
  }

  // Reject transactions that already reverted on-chain so a known-failed hash
  // never becomes a lingering PENDING deposit. Not-yet-mined txs are allowed
  // through (they confirm later); only a definitive revert is blocked.
  if (isProductionRuntime()) {
    const outcome = await getTxOutcome(
      input.network as StakingNetwork,
      verifiedInput.txHash,
    );
    if (outcome === "reverted") {
      throw new DepositServiceError(
        "Transaction failed on-chain",
        "TX_REVERTED",
      );
    }
  }

  const created = await prisma.deposit.create({
    data: {
      userId: input.userId,
      network: input.network,
      amount: toMicro(verifiedInput.amount),
      fromAddress: verifiedInput.fromAddress,
      toAddress: verifiedInput.toAddress,
      txHash: verifiedInput.txHash,
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

  const next = await syncOnChainConfirmations(deposit);
  await prisma.deposit.update({
    where: { id: deposit.id },
    data: { confirmations: next },
  });

  if (next >= REQUIRED_CONFIRMATIONS) {
    return confirmDeposit(deposit.id);
  }

  const updated = await prisma.deposit.findUniqueOrThrow({
    where: { id: deposit.id },
    include: { stake: { select: { id: true } } },
  });
  return serializeDeposit(updated);
}

interface PendingDepositRow {
  id: string;
  network: Network;
  txHash: string;
  confirmations: number;
}

type ReconcileOutcome = "confirmed" | "failed" | "pending";

/** Marks a still-pending deposit as FAILED (no-op if it already progressed). */
async function markDepositFailed(depositId: string): Promise<void> {
  await prisma.deposit.updateMany({
    where: { id: depositId, status: "PENDING" },
    data: { status: "FAILED" },
  });
}

/**
 * Reconciles a single pending deposit against the chain:
 * - if the transaction reverted on-chain, marks the deposit FAILED (so failed
 *   transactions stop lingering as PENDING forever);
 * - otherwise re-syncs the confirmation count and confirms once ready.
 *
 * Failures (transient RPC/verification issues) are swallowed so one deposit
 * can't block the reconciliation of others; it is retried on the next pass.
 */
async function reconcilePendingDepositRow(
  row: PendingDepositRow,
): Promise<ReconcileOutcome> {
  try {
    if (!row.txHash) return "pending";

    if (isProductionRuntime()) {
      const outcome = await getTxOutcome(row.network as StakingNetwork, row.txHash);
      if (outcome === "reverted") {
        await markDepositFailed(row.id);
        return "failed";
      }
    }

    const next = await syncOnChainConfirmations(row);
    if (next !== row.confirmations) {
      await prisma.deposit.update({
        where: { id: row.id },
        data: { confirmations: next },
      });
    }

    if (next >= REQUIRED_CONFIRMATIONS) {
      await confirmDeposit(row.id);
      return "confirmed";
    }
    return "pending";
  } catch {
    return "pending";
  }
}

/**
 * Reconciles a user's PENDING deposits against the chain.
 *
 * Unlike a passive finalizer, this actively re-reads the on-chain confirmation
 * count for each pending deposit and confirms those that are ready. This is the
 * safety net that activates a deposit even when the user closed the deposit
 * modal before client-side polling finished: the funds are already on chain, so
 * the stake is created as soon as confirmations reach the threshold.
 */
export async function finalizeReadyPendingDeposits(userId: string): Promise<number> {
  const pending = await prisma.deposit.findMany({
    where: {
      userId,
      status: "PENDING",
    },
    select: { id: true, network: true, txHash: true, confirmations: true },
  });

  let confirmed = 0;
  for (const row of pending) {
    if ((await reconcilePendingDepositRow(row)) === "confirmed") confirmed += 1;
  }
  return confirmed;
}

/**
 * Platform-wide reconciliation of every PENDING deposit (cron safety net for
 * users who never return to the app after depositing).
 */
export async function reconcileAllPendingDeposits(limit = 500): Promise<{
  scanned: number;
  confirmed: number;
  failed: number;
}> {
  const pending = await prisma.deposit.findMany({
    where: { status: "PENDING" },
    select: { id: true, network: true, txHash: true, confirmations: true },
    orderBy: { detectedAt: "asc" },
    take: limit,
  });

  let confirmed = 0;
  let failed = 0;
  for (const row of pending) {
    const outcome = await reconcilePendingDepositRow(row);
    if (outcome === "confirmed") confirmed += 1;
    else if (outcome === "failed") failed += 1;
  }
  return { scanned: pending.length, confirmed, failed };
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
  await assertDepositReadyForConfirm(deposit);
  return confirmDeposit(depositId);
}

export async function confirmDeposit(depositId: string): Promise<DepositDto> {
  const deposit = await prisma.deposit.findUnique({
    where: { id: depositId },
    include: { stake: true },
  });
  if (!deposit) throw new DepositServiceError("Deposit not found", "NOT_FOUND");
  if (deposit.status === "CONFIRMED") {
    // Idempotent: recover Net Deposit if a prior confirm credited capital but
    // creditIbNetDepositForDeposit failed afterward.
    try {
      await creditIbNetDepositForDeposit({
        depositId: deposit.id,
        sourceUserId: deposit.userId,
        depositAmountMicro: deposit.amount,
      });
    } catch (err) {
      console.error("[ib-net-deposit] credit retry on confirmed deposit failed", {
        depositId: deposit.id,
        err,
      });
    }
    return serializeDeposit(deposit);
  }

  const verified = await assertDepositReadyForConfirm(deposit);
  const creditedAmount =
    isProductionRuntime() && verified.amount > 0
      ? toMicro(verified.amount)
      : deposit.amount;

  const updated = await prisma.$transaction(async (tx) => {
    const confirmed = await tx.deposit.update({
      where: { id: deposit.id },
      data: {
        status: "CONFIRMED",
        amount: creditedAmount,
        confirmations: Math.max(deposit.confirmations, REQUIRED_CONFIRMATIONS),
        confirmedAt: new Date(),
        ...(verified.toAddress
          ? { toAddress: verified.toAddress }
          : {}),
      },
    });

    let stake = deposit.stake;
    if (!stake) {
      stake = await tx.stake.create({
        data: {
          userId: deposit.userId,
          amount: creditedAmount,
          network: deposit.network,
          depositId: confirmed.id,
          status: "ACTIVE",
          source: "ON_CHAIN",
        },
      });

      await tx.user.update({
        where: { id: deposit.userId },
        data: {
          lockedCapital: {
            increment: creditedAmount,
          },
        },
      });
    } else if (
      stake.source === "COMPANY_SPONSORED" &&
      stake.depositId == null
    ) {
      await tx.stake.create({
        data: {
          userId: deposit.userId,
          amount: creditedAmount,
          network: deposit.network,
          depositId: confirmed.id,
          status: "ACTIVE",
          source: "ON_CHAIN",
        },
      });

      await tx.user.update({
        where: { id: deposit.userId },
        data: {
          lockedCapital: {
            increment: creditedAmount,
          },
        },
      });
    } else if (stake.depositId == null) {
      await tx.stake.update({
        where: { id: stake.id },
        data: {
          source: "ON_CHAIN",
          depositId: confirmed.id,
        },
      });
    }

    return tx.deposit.findUniqueOrThrow({
      where: { id: confirmed.id },
      include: { stake: true },
    });
  });

  await refreshUserPayoutCap(deposit.userId);
  await propagateRealDepositVolume(deposit.userId, creditedAmount);
  await evaluateAndPersistWithdrawalUnlock(deposit.userId);
  try {
    await creditIbNetDepositForDeposit({
      depositId: updated.id,
      sourceUserId: deposit.userId,
      depositAmountMicro: creditedAmount,
    });
  } catch (err) {
    // Deposit is already confirmed — never roll it back. Credits are idempotent
    // via unique (beneficiaryId, depositId); log and continue.
    console.error("[ib-net-deposit] credit failed after confirm", {
      depositId: updated.id,
      err,
    });
  }

  return serializeDeposit(updated);
}

/** Credits active capital from an on-chain USDT transfer (in-app or manual). */
export async function claimDepositFromTx(input: {
  userId: string;
  walletAddress: string;
  network: StakingNetwork;
  txHash: string;
}): Promise<DepositDto> {
  const normalizedHash = input.txHash.toLowerCase();
  const existing = await prisma.deposit.findUnique({
    where: { txHash: normalizedHash },
    include: { stake: true },
  });

  if (existing) {
    if (existing.userId !== input.userId) {
      throw new DepositServiceError(
        "Transaction belongs to another account",
        "TX_OWNED_BY_OTHER",
      );
    }
    if (existing.status === "CONFIRMED") {
      return serializeDeposit(existing);
    }

    if (isProductionRuntime()) {
      const outcome = await getTxOutcome(input.network, normalizedHash);
      if (outcome === "reverted") {
        await markDepositFailed(existing.id);
        throw new DepositServiceError(
          "Transaction failed on-chain",
          "TX_REVERTED",
        );
      }
    }

    const confirmations = isProductionRuntime()
      ? await getTxConfirmationCount(input.network, normalizedHash)
      : REQUIRED_CONFIRMATIONS;

    await prisma.deposit.update({
      where: { id: existing.id },
      data: { confirmations: Math.min(confirmations, REQUIRED_CONFIRMATIONS) },
    });

    if (confirmations < REQUIRED_CONFIRMATIONS) {
      const pending = await prisma.deposit.findUniqueOrThrow({
        where: { id: existing.id },
        include: { stake: { select: { id: true } } },
      });
      return serializeDeposit(pending);
    }

    return confirmDeposit(existing.id);
  }

  const verified = await verifyUsdtDepositTx({
    network: input.network,
    txHash: normalizedHash,
    expectedFrom: normalizeWallet(input.walletAddress),
    waitForMining: true,
  });
  if (!verified) {
    throw new DepositServiceError(
      "Could not verify USDT transfer to treasury",
      "TX_NOT_VERIFIED",
    );
  }

  const config = await getPlatformConfig();
  if (verified.amount < config.minStake || verified.amount > config.maxStake) {
    throw new DepositServiceError("Invalid amount", "INVALID_AMOUNT");
  }

  const registered = await registerDeposit({
    userId: input.userId,
    network: input.network,
    amount: verified.amount,
    fromAddress: verified.fromAddress,
    toAddress: verified.toAddress,
    txHash: normalizedHash,
  });

  const confirmations = isProductionRuntime()
    ? await getTxConfirmationCount(input.network, normalizedHash)
    : REQUIRED_CONFIRMATIONS;

  await prisma.deposit.update({
    where: { id: registered.id },
    data: { confirmations: Math.min(confirmations, REQUIRED_CONFIRMATIONS) },
  });

  if (confirmations < REQUIRED_CONFIRMATIONS) {
    const pending = await prisma.deposit.findUniqueOrThrow({
      where: { id: registered.id },
      include: { stake: { select: { id: true } } },
    });
    return serializeDeposit(pending);
  }

  return confirmDeposit(registered.id);
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
