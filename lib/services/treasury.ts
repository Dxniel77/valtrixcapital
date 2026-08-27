import type { Network, Prisma, TreasuryDepositStatus, TreasuryPool } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeWallet } from "@/lib/auth/admins";
import { fromMicro, toMicro } from "@/lib/utils";
import {
  getTxConfirmationCount,
  verifyAdminTreasuryDeposit,
} from "@/lib/services/deposit-verification";
import { isProductionRuntime } from "@/lib/runtime-mode";
import type { StakingNetwork } from "@/lib/staking/store";
import { getCopyPayoutLiquidity } from "@/lib/services/copy-wallet-liquidity";

export const TREASURY_USER_DEPOSIT_MARKER = "USER_DEPOSIT";

export class TreasuryServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INVALID_AMOUNT"
      | "INSUFFICIENT_FUNDS"
      | "INVALID_ADDRESS"
      | "ALREADY_CONFIRMED"
      | "TX_NOT_VERIFIED",
  ) {
    super(message);
    this.name = "TreasuryServiceError";
  }
}

export interface TreasuryBalancesDto {
  bscBalance: number;
  polygonBalance: number;
  totalBalance: number;
  copyBscBalance: number;
  copyPolygonBalance: number;
  copyTotalBalance: number;
}

export interface TreasuryPoolTotalsDto {
  adminDeposited: number;
  paidOut: number;
  copyInflow: number;
  copyPaidOut: number;
}

export interface TreasuryDepositDto {
  id: string;
  network: Network;
  pool: TreasuryPool;
  amount: number;
  txHash: string;
  confirmations: number;
  requiredConfirmations: number;
  status: TreasuryDepositStatus;
  startedAt: string;
  confirmedAt: string | null;
}

export interface TreasuryWithdrawalDto {
  id: string;
  network: Network;
  pool: TreasuryPool;
  amount: number;
  toAddress: string;
  txHash: string | null;
  note: string;
  kind: "MANUAL" | "USER_PAYOUT";
  userWithdrawalId: string | null;
  createdAt: string;
}

export interface TreasurySnapshotDto {
  balances: TreasuryBalancesDto;
  totals: TreasuryPoolTotalsDto;
  deposits: TreasuryDepositDto[];
  withdrawals: TreasuryWithdrawalDto[];
}

type TreasuryTx = Prisma.TransactionClient;

const adminPoolDepositWhere = {
  status: "CONFIRMED" as const,
  NOT: { recordedBy: TREASURY_USER_DEPOSIT_MARKER },
};

function stakingBalanceField(network: Network): "bscBalance" | "polygonBalance" {
  return network === "POLYGON" ? "polygonBalance" : "bscBalance";
}

function copyBalanceField(
  network: Network,
): "copyBscBalance" | "copyPolygonBalance" {
  return network === "POLYGON" ? "copyPolygonBalance" : "copyBscBalance";
}

function balanceField(
  network: Network,
  pool: TreasuryPool = "STAKING",
): "bscBalance" | "polygonBalance" | "copyBscBalance" | "copyPolygonBalance" {
  return pool === "COPY" ? copyBalanceField(network) : stakingBalanceField(network);
}

function emptyNetworkTotals(): Record<Network, bigint> {
  return { BSC: 0n, POLYGON: 0n };
}

function applyNetworkSums(
  rows: Array<{ network: Network; _sum: { amount: bigint | null } }>,
): Record<Network, bigint> {
  const out = emptyNetworkTotals();
  for (const row of rows) {
    out[row.network] = row._sum.amount ?? 0n;
  }
  return out;
}

export function treasuryPoolFromPurpose(
  purpose: "STAKING" | "COPY" | string | null | undefined,
): TreasuryPool {
  return purpose === "COPY" ? "COPY" : "STAKING";
}

export function treasuryPoolFromWithdrawalSource(
  source: "EARNINGS" | "COPY_CASH" | string | null | undefined,
): TreasuryPool {
  return source === "COPY_CASH" ? "COPY" : "STAKING";
}

function isAdminPoolDeposit(recordedBy: string | null | undefined): boolean {
  return recordedBy !== TREASURY_USER_DEPOSIT_MARKER;
}

async function sumConfirmedAdminDepositsByPool(
  pool: TreasuryPool,
): Promise<Record<Network, bigint>> {
  const rows = await prisma.treasuryDeposit.groupBy({
    by: ["network"],
    where: { ...adminPoolDepositWhere, pool },
    _sum: { amount: true },
  });
  return applyNetworkSums(rows);
}

async function sumWithdrawalsByPool(
  pool: TreasuryPool,
): Promise<Record<Network, bigint>> {
  const rows = await prisma.treasuryWithdrawal.groupBy({
    by: ["network"],
    where: { pool },
    _sum: { amount: true },
  });
  return applyNetworkSums(rows);
}

async function sumConfirmedUserCopyDepositsByNetwork(): Promise<
  Record<Network, bigint>
> {
  const rows = await prisma.deposit.groupBy({
    by: ["network"],
    where: { status: "CONFIRMED", purpose: "COPY" },
    _sum: { amount: true },
  });
  return applyNetworkSums(rows);
}

function netPoolBalance(deposits: bigint, withdrawals: bigint): bigint {
  return deposits > withdrawals ? deposits - withdrawals : 0n;
}

function toBalancesDto(
  staking: Record<Network, bigint>,
  copy: Record<Network, bigint>,
): TreasuryBalancesDto {
  const bsc = fromMicro(staking.BSC);
  const polygon = fromMicro(staking.POLYGON);
  const copyBsc = fromMicro(copy.BSC);
  const copyPolygon = fromMicro(copy.POLYGON);
  return {
    bscBalance: bsc,
    polygonBalance: polygon,
    totalBalance: bsc + polygon,
    copyBscBalance: copyBsc,
    copyPolygonBalance: copyPolygon,
    copyTotalBalance: copyBsc + copyPolygon,
  };
}

async function withLiveCopyWalletBalances(
  ledger: TreasuryBalancesDto,
): Promise<TreasuryBalancesDto> {
  const [copyBsc, copyPolygon] = await Promise.all([
    getCopyPayoutLiquidity("BSC"),
    getCopyPayoutLiquidity("POLYGON"),
  ]);
  const copyBscBalance = copyBsc ?? ledger.copyBscBalance;
  const copyPolygonBalance = copyPolygon ?? ledger.copyPolygonBalance;
  return {
    ...ledger,
    copyBscBalance,
    copyPolygonBalance,
    copyTotalBalance: copyBscBalance + copyPolygonBalance,
  };
}

/** Recomputes staking (admin loads − staking payouts) and copy ledger (deposits − payouts). */
export async function reconcileTreasuryState(): Promise<TreasuryBalancesDto> {
  const [stakingIn, stakingOut, copyAdminIn, copyUserIn, copyOut] =
    await Promise.all([
      sumConfirmedAdminDepositsByPool("STAKING"),
      sumWithdrawalsByPool("STAKING"),
      sumConfirmedAdminDepositsByPool("COPY"),
      sumConfirmedUserCopyDepositsByNetwork(),
      sumWithdrawalsByPool("COPY"),
    ]);

  const staking = {
    BSC: netPoolBalance(stakingIn.BSC, stakingOut.BSC),
    POLYGON: netPoolBalance(stakingIn.POLYGON, stakingOut.POLYGON),
  };
  const copy = {
    BSC: netPoolBalance(copyAdminIn.BSC + copyUserIn.BSC, copyOut.BSC),
    POLYGON: netPoolBalance(
      copyAdminIn.POLYGON + copyUserIn.POLYGON,
      copyOut.POLYGON,
    ),
  };

  await prisma.treasuryState.upsert({
    where: { id: 1 },
    update: {
      bscBalance: staking.BSC,
      polygonBalance: staking.POLYGON,
      copyBscBalance: copy.BSC,
      copyPolygonBalance: copy.POLYGON,
    },
    create: {
      id: 1,
      bscBalance: staking.BSC,
      polygonBalance: staking.POLYGON,
      copyBscBalance: copy.BSC,
      copyPolygonBalance: copy.POLYGON,
    },
  });

  return toBalancesDto(staking, copy);
}

export async function getTreasuryLiquidity(): Promise<TreasuryBalancesDto> {
  return withLiveCopyWalletBalances(await reconcileTreasuryState());
}

export async function assertTreasuryLiquidityForPayout(
  network: Network,
  netAmount: number,
  pool: TreasuryPool = "STAKING",
): Promise<void> {
  if (!Number.isFinite(netAmount) || netAmount <= 0) {
    throw new TreasuryServiceError("Invalid amount", "INVALID_AMOUNT");
  }

  const balances = await getTreasuryLiquidity();
  const available =
    pool === "COPY"
      ? network === "POLYGON"
        ? balances.copyPolygonBalance
        : balances.copyBscBalance
      : network === "POLYGON"
        ? balances.polygonBalance
        : balances.bscBalance;
  if (netAmount > available) {
    throw new TreasuryServiceError(
      pool === "COPY"
        ? "Insufficient copy-trading liquidity for payout"
        : "Insufficient treasury liquidity for payout",
      "INSUFFICIENT_FUNDS",
    );
  }
}

function serializeDeposit(row: {
  id: string;
  network: Network;
  pool: TreasuryPool;
  amount: bigint;
  txHash: string;
  confirmations: number;
  requiredConfirmations: number;
  status: TreasuryDepositStatus;
  startedAt: Date;
  confirmedAt: Date | null;
}): TreasuryDepositDto {
  return {
    id: row.id,
    network: row.network,
    pool: row.pool,
    amount: fromMicro(row.amount),
    txHash: row.txHash,
    confirmations: row.confirmations,
    requiredConfirmations: row.requiredConfirmations,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  };
}

function serializeWithdrawal(row: {
  id: string;
  network: Network;
  pool: TreasuryPool;
  amount: bigint;
  toAddress: string;
  txHash: string | null;
  note: string;
  kind: "MANUAL" | "USER_PAYOUT";
  userWithdrawalId: string | null;
  createdAt: Date;
}): TreasuryWithdrawalDto {
  return {
    id: row.id,
    network: row.network,
    pool: row.pool,
    amount: fromMicro(row.amount),
    toAddress: row.toAddress,
    txHash: row.txHash,
    note: row.note,
    kind: row.kind,
    userWithdrawalId: row.userWithdrawalId,
    createdAt: row.createdAt.toISOString(),
  };
}

async function computePoolTotals(): Promise<TreasuryPoolTotalsDto> {
  const [adminStaking, stakingPaid, adminCopy, userCopy, copyPaid] =
    await Promise.all([
      prisma.treasuryDeposit.aggregate({
        where: { ...adminPoolDepositWhere, pool: "STAKING" },
        _sum: { amount: true },
      }),
      prisma.treasuryWithdrawal.aggregate({
        where: { pool: "STAKING" },
        _sum: { amount: true },
      }),
      prisma.treasuryDeposit.aggregate({
        where: { ...adminPoolDepositWhere, pool: "COPY" },
        _sum: { amount: true },
      }),
      prisma.deposit.aggregate({
        where: { status: "CONFIRMED", purpose: "COPY" },
        _sum: { amount: true },
      }),
      prisma.treasuryWithdrawal.aggregate({
        where: { pool: "COPY" },
        _sum: { amount: true },
      }),
    ]);

  return {
    adminDeposited: fromMicro(adminStaking._sum.amount ?? 0n),
    paidOut: fromMicro(stakingPaid._sum.amount ?? 0n),
    copyInflow: fromMicro(
      (adminCopy._sum.amount ?? 0n) + (userCopy._sum.amount ?? 0n),
    ),
    copyPaidOut: fromMicro(copyPaid._sum.amount ?? 0n),
  };
}

export async function getTreasurySnapshot(
  limit = 100,
): Promise<TreasurySnapshotDto> {
  const [balances, totals, deposits, withdrawals] = await Promise.all([
    getTreasuryLiquidity(),
    computePoolTotals(),
    prisma.treasuryDeposit.findMany({
      where: { NOT: { recordedBy: TREASURY_USER_DEPOSIT_MARKER } },
      orderBy: { startedAt: "desc" },
      take: limit,
    }),
    prisma.treasuryWithdrawal.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  return {
    balances,
    totals,
    deposits: deposits.map(serializeDeposit),
    withdrawals: withdrawals.map(serializeWithdrawal),
  };
}

export async function incrementTreasuryPoolInTx(
  tx: TreasuryTx,
  network: Network,
  amountMicro: bigint,
  pool: TreasuryPool = "STAKING",
): Promise<void> {
  const field = balanceField(network, pool);
  await tx.treasuryState.upsert({
    where: { id: 1 },
    update: { [field]: { increment: amountMicro } },
    create: { id: 1, [field]: amountMicro },
  });
}

async function decrementPoolBalanceInTx(
  tx: TreasuryTx,
  network: Network,
  amountMicro: bigint,
  pool: TreasuryPool = "STAKING",
): Promise<void> {
  const field = balanceField(network, pool);
  const state = await tx.treasuryState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  if (state[field] < amountMicro) {
    throw new TreasuryServiceError("Insufficient treasury funds", "INSUFFICIENT_FUNDS");
  }
  await tx.treasuryState.update({
    where: { id: 1 },
    data: { [field]: { decrement: amountMicro } },
  });
}

export async function createTreasuryDeposit(input: {
  network: Network;
  pool?: TreasuryPool;
  amount: number;
  txHash: string;
  requiredConfirmations: number;
  recordedBy?: string;
  status?: TreasuryDepositStatus;
  confirmations?: number;
}): Promise<TreasuryDepositDto> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new TreasuryServiceError("Invalid amount", "INVALID_AMOUNT");
  }

  const pool = input.pool ?? "STAKING";
  let amount = input.amount;
  let txHash = input.txHash.toLowerCase();
  let status = input.status ?? "CONFIRMING";
  let confirmations = input.confirmations ?? 0;

  if (isProductionRuntime()) {
    if (!input.recordedBy) {
      throw new TreasuryServiceError(
        "Admin wallet required to verify treasury deposit",
        "INVALID_ADDRESS",
      );
    }

    const verified = await verifyAdminTreasuryDeposit({
      network: input.network as StakingNetwork,
      txHash,
      expectedFrom: normalizeWallet(input.recordedBy),
      waitForMining: true,
      pool,
    });
    if (!verified) {
      throw new TreasuryServiceError(
        "Could not verify USDT transfer to treasury",
        "TX_NOT_VERIFIED",
      );
    }

    amount = verified.amount;
    confirmations = await getTxConfirmationCount(
      input.network as StakingNetwork,
      txHash,
    );
    if (confirmations >= input.requiredConfirmations) {
      status = "CONFIRMED";
    } else {
      status = "CONFIRMING";
    }
  }

  const amountMicro = toMicro(amount);

  if (status === "CONFIRMED") {
    const row = await prisma.$transaction(async (tx) => {
      const deposit = await tx.treasuryDeposit.create({
        data: {
          network: input.network,
          pool,
          amount: amountMicro,
          txHash: txHash,
          confirmations: input.requiredConfirmations,
          requiredConfirmations: input.requiredConfirmations,
          status: "CONFIRMED",
          recordedBy: input.recordedBy ?? null,
          confirmedAt: new Date(),
        },
      });

      if (isAdminPoolDeposit(deposit.recordedBy)) {
        await incrementTreasuryPoolInTx(tx, input.network, amountMicro, pool);
      }

      return deposit;
    });
    return serializeDeposit(row);
  }

  const row = await prisma.treasuryDeposit.create({
    data: {
      network: input.network,
      pool,
      amount: amountMicro,
      txHash,
      confirmations,
      requiredConfirmations: input.requiredConfirmations,
      status: "CONFIRMING",
      recordedBy: input.recordedBy ?? null,
    },
  });
  return serializeDeposit(row);
}

export async function updateTreasuryDeposit(input: {
  depositId: string;
  confirmations?: number;
  confirm?: boolean;
}): Promise<TreasuryDepositDto> {
  const existing = await prisma.treasuryDeposit.findUnique({
    where: { id: input.depositId },
  });
  if (!existing) {
    throw new TreasuryServiceError("Deposit not found", "NOT_FOUND");
  }
  if (existing.status === "CONFIRMED") {
    throw new TreasuryServiceError("Deposit already confirmed", "ALREADY_CONFIRMED");
  }

  let confirmations = input.confirmations ?? existing.confirmations;

  if (isProductionRuntime()) {
    confirmations = await getTxConfirmationCount(
      existing.network as StakingNetwork,
      existing.txHash,
    );
  }

  const shouldConfirm =
    input.confirm === true ||
    confirmations >= existing.requiredConfirmations;

  if (!shouldConfirm) {
    const row = await prisma.treasuryDeposit.update({
      where: { id: existing.id },
      data: { confirmations },
    });
    return serializeDeposit(row);
  }

  if (isProductionRuntime()) {
    if (!existing.recordedBy) {
      throw new TreasuryServiceError(
        "Admin wallet required to verify treasury deposit",
        "INVALID_ADDRESS",
      );
    }
    const verified = await verifyAdminTreasuryDeposit({
      network: existing.network as StakingNetwork,
      txHash: existing.txHash,
      expectedFrom: normalizeWallet(existing.recordedBy),
      waitForMining: false,
      pool: existing.pool,
    });
    if (!verified) {
      throw new TreasuryServiceError(
        "Could not verify USDT transfer to treasury",
        "TX_NOT_VERIFIED",
      );
    }
    if (confirmations < existing.requiredConfirmations) {
      const row = await prisma.treasuryDeposit.update({
        where: { id: existing.id },
        data: { confirmations },
      });
      return serializeDeposit(row);
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    const deposit = await tx.treasuryDeposit.update({
      where: { id: existing.id },
      data: {
        confirmations: existing.requiredConfirmations,
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });

    if (isAdminPoolDeposit(deposit.recordedBy)) {
      await incrementTreasuryPoolInTx(
        tx,
        existing.network,
        existing.amount,
        existing.pool,
      );
    }

    return deposit;
  });

  return serializeDeposit(row);
}

export async function recordTreasuryWithdrawal(input: {
  network: Network;
  pool?: TreasuryPool;
  amount: number;
  toAddress: string;
  txHash?: string | null;
  note?: string;
  createdBy?: string;
}): Promise<TreasuryWithdrawalDto> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new TreasuryServiceError("Invalid amount", "INVALID_AMOUNT");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.toAddress)) {
    throw new TreasuryServiceError("Invalid address", "INVALID_ADDRESS");
  }

  const pool = input.pool ?? "STAKING";
  const amountMicro = toMicro(input.amount);

  const row = await prisma.$transaction(async (tx) => {
    await decrementPoolBalanceInTx(tx, input.network, amountMicro, pool);

    return tx.treasuryWithdrawal.create({
      data: {
        network: input.network,
        pool,
        amount: amountMicro,
        toAddress: input.toAddress.toLowerCase(),
        txHash: input.txHash?.trim() || null,
        note: input.note?.trim() ?? "",
        kind: "MANUAL",
        createdBy: input.createdBy ?? null,
      },
    });
  });

  return serializeWithdrawal(row);
}

/** Treasury payout debit — must run inside the caller's transaction. */
export async function deductTreasuryForUserPayoutInTx(
  tx: TreasuryTx,
  input: {
    userWithdrawalId: string;
    network: Network;
    pool?: TreasuryPool;
    netAmount: number;
    toAddress: string;
    txHash?: string | null;
    createdBy?: string;
  },
): Promise<void> {
  const existingPayout = await tx.treasuryWithdrawal.findUnique({
    where: { userWithdrawalId: input.userWithdrawalId },
  });
  if (existingPayout) return;

  if (!Number.isFinite(input.netAmount) || input.netAmount <= 0) {
    throw new TreasuryServiceError("Invalid amount", "INVALID_AMOUNT");
  }

  const pool = input.pool ?? "STAKING";
  const amountMicro = toMicro(input.netAmount);
  await decrementPoolBalanceInTx(tx, input.network, amountMicro, pool);

  await tx.treasuryWithdrawal.create({
    data: {
      network: input.network,
      pool,
      amount: amountMicro,
      toAddress: input.toAddress.toLowerCase(),
      txHash: input.txHash?.trim() || null,
      note: "User withdrawal payout",
      kind: "USER_PAYOUT",
      userWithdrawalId: input.userWithdrawalId,
      createdBy: input.createdBy ?? null,
    },
  });
}

/** Deducts treasury liquidity when a user withdrawal is confirmed on-chain. */
export async function deductTreasuryForUserPayout(input: {
  userWithdrawalId: string;
  network: Network;
  pool?: TreasuryPool;
  netAmount: number;
  toAddress: string;
  txHash?: string | null;
  createdBy?: string;
}): Promise<TreasuryWithdrawalDto> {
  const existingPayout = await prisma.treasuryWithdrawal.findUnique({
    where: { userWithdrawalId: input.userWithdrawalId },
  });
  if (existingPayout) {
    return serializeWithdrawal(existingPayout);
  }

  const row = await prisma.$transaction(async (tx) => {
    await deductTreasuryForUserPayoutInTx(tx, input);
    return tx.treasuryWithdrawal.findUniqueOrThrow({
      where: { userWithdrawalId: input.userWithdrawalId },
    });
  });

  return serializeWithdrawal(row);
}
