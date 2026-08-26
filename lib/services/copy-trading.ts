import type {
  CopyInvestmentStatus,
  CopyLedgerKind,
  CopyPeriod,
  CopyRiskLevel,
  CopyWithdrawalMode,
  CopyWithdrawalStatus,
  Prisma,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  applyPerformance,
  applyPerformanceWithFee,
} from "@/lib/copy-trading/sync-engine";
import { eligibleForLiveOperation } from "@/lib/copy-trading/eligibility";
import {
  generateShowcaseCopiers,
  showcaseCountForTrader,
} from "@/lib/copy-trading/showcase-copiers";
import {
  DEFAULT_DURATION_MAX_MINUTES,
  DEFAULT_DURATION_MIN_MINUTES,
  DEFAULT_MAX_OPS_PER_DAY,
  DEFAULT_MIN_OPS_PER_DAY,
  afterCloseSchedule,
  deterministicRange,
  ensureDayPlan,
  nextWakeAt,
  operationDurationMs,
  operationOpenIdempotencyKey,
  operationSettlementKey,
  scheduleDigest,
  simulatedOpenKey,
  type DayPlan,
  type ScheduleSettings,
  utcDayStart,
  utcNextDayStart,
} from "@/lib/copy-trading/operation-schedule";
import {
  COPY_NETWORK_LEVELS,
  DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
  normalizePerformanceFeeNetworkBps,
  splitPerformanceFeeNetwork,
  traderPerformanceFeeBps,
} from "@/lib/copy-trading/performance-fee-network";
import { distributePerformanceFeeNetwork } from "@/lib/copy-trading/distribute-performance-fee-network";
import {
  DEFAULT_COPY_CASH_WALLET_FEE_BPS,
  DEFAULT_INVEST_FEE_BPS,
  DEFAULT_OPEN_FEE_BPS,
  DEFAULT_WITHDRAW_FEE_BPS,
  platformOpenFeeMicro,
  platformOpenFeeNote,
} from "@/lib/copy-trading/platform-open-fee";
import {
  DEFAULT_LOSS_PROB_BPS,
  DEFAULT_TARGET_CYCLE_DAYS,
  DEFAULT_WIN_PROB_BPS,
  assignOperationRole,
  pickTargetedReturnBps,
  resolveTargetCycleStart,
  targetElapsedDays,
  targetProgressSnapshot,
} from "@/lib/copy-trading/monthly-target";
import { riskProfileOf } from "@/lib/copy-trading/risk-profiles";
import { floatingReturnBps } from "@/lib/copy-trading/floating-path";
import {
  COPY_MARKETS,
  marketsFromSymbols,
  normalizeActiveSymbols,
  pickMarket,
} from "@/lib/copy-trading/markets";
import {
  MAX_MANUAL_DELAY_MINUTES,
  buildManualHistoryOp,
  buildSyntheticHistoryOps,
  isHistoryBias,
  type HistoryBias,
  type SyntheticHistoryOp,
} from "@/lib/copy-trading/synthetic-history";
import { resolveUplineChain } from "@/lib/services/referral-chain";
import { getDefaultAdminActorId } from "@/lib/services/admin";
import { fromMicro, toMicro } from "@/lib/utils";

export class CopyTradingError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INVALID_AMOUNT"
      | "INSUFFICIENT_BALANCE"
      | "INACTIVE"
      | "FORBIDDEN"
      | "TRADER_UNAVAILABLE"
      | "CAPACITY_FULL",
  ) {
    super(message);
    this.name = "CopyTradingError";
  }
}

export type CopyTraderPerformanceDto = {
  period: CopyPeriod;
  returnBps: number;
};

export type CopyTraderDto = {
  id: string;
  name: string;
  photoUrl: string | null;
  description: string;
  countryCode: string | null;
  countryName: string | null;
  riskLevel: CopyRiskLevel;
  experienceDays: number;
  profitDays: number;
  followersCount: number;
  investorsCount: number;
  aum: number;
  totalInvested: number;
  roiBps: number;
  cumulativeRoiBps: number;
  winRateBps: number;
  maxDrawdownBps: number;
  tradeVolume: number;
  winningTrades: number;
  losingTrades: number;
  minInvestment: number;
  performanceFeeBps: number;
  maxInvestors: number;
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder: number;
  performances?: CopyTraderPerformanceDto[];
  currentOperation?: CopyTraderOperationDto | null;
  createdAt: string;
  updatedAt: string;
};

export type CopyTraderChartPointDto = {
  date: string;
  valueBps: number;
};

export type CopyTraderDetailDto = CopyTraderDto & {
  performances: CopyTraderPerformanceDto[];
  chartPoints: CopyTraderChartPointDto[];
};

export type AdminCopyTraderDto = CopyTraderDto & {
  showcaseCopiers: number;
  simulationEnabled: boolean;
  simulationMinBps: number;
  simulationMaxBps: number;
  simulationIntervalHours: number;
  simulationMinOpsPerDay: number;
  simulationMaxOpsPerDay: number;
  simulationDurationMinMinutes: number;
  simulationDurationMaxMinutes: number;
  simulationOpsDayKey: string | null;
  simulationOpsToday: number;
  simulationOpsTarget: number;
  simulationLastRunAt: string | null;
  simulationNextRunAt: string | null;
  nextOperationAt: string | null;
  winProbBps: number;
  lossProbBps: number;
  targetMode: boolean;
  monthlyTargetBps: number;
  targetCycleDays: number;
  targetCycleStartedAt: string | null;
  activeInvestments: number;
  copierPrincipal: number;
  copierValue: number;
  copierPnl: number;
  lastReturnBps: number | null;
  lastReturnAt: string | null;
};

export type CopyTradingConfigDto = {
  globalMinInvestment: number;
  withdrawalMode: CopyWithdrawalMode;
  notifyOnPerformance: boolean;
  investFeeBps: number;
  withdrawFeeBps: number;
  copyCashWalletFeeBps: number;
  performanceFeeNetworkBps: number[];
  openFeeBps: number;
  activeSymbols: string[];
};

export type CopyInvestmentDto = {
  id: string;
  traderId: string;
  traderName: string;
  traderRisk: CopyRiskLevel;
  traderPhotoUrl?: string | null;
  traderCountryCode?: string | null;
  traderAum?: number;
  traderRoiBps?: number;
  traderWinRateBps?: number;
  investorsCount?: number;
  maxInvestors?: number;
  principal: number;
  currentValue: number;
  realizedPnl: number;
  roiBps: number;
  status: CopyInvestmentStatus;
  startedAt: number;
};

export type CopyInvestmentHistoryOperationDto = {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  leverage: number;
  settledReturnBps: number | null;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  myPnl: number;
  myFee: number;
  myNet: number;
};

export type CopyInvestmentHistoryMovementDto = {
  id: string;
  kind: CopyLedgerKind;
  amount: number;
  balanceAfter: number;
  at: number;
  note: string | null;
};

export type CopyInvestmentHistoryDto = {
  investment: CopyInvestmentDto;
  summary: {
    capitalPlaced: number;
    startedAt: number;
    currentValue: number;
    withdrawn: number;
    gains: number;
    losses: number;
    accumulatedPnl: number;
    commissionsPaid: number;
    netResult: number;
  };
  operations: CopyInvestmentHistoryOperationDto[];
  movements: CopyInvestmentHistoryMovementDto[];
};

export type CopyWithdrawalDto = {
  id: string;
  investmentId: string;
  traderId: string;
  traderName: string;
  amount: number;
  status: CopyWithdrawalStatus;
  requestedAt: number;
  processedAt: number | null;
};

type TraderRow = Prisma.CopyTraderGetPayload<{
  include: { performances: true; chartPoints: true };
}>;

type InvestmentRow = Prisma.CopyInvestmentGetPayload<{
  include: { trader: true };
}>;

export type CopyPerformanceEventDto = {
  id: string;
  traderId: string;
  traderName: string;
  period: CopyPeriod;
  returnBps: number;
  source: string;
  createdAt: string;
};

export type CopyTraderOperationDto = {
  id: string;
  traderId: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  leverage: number;
  entryPrice: number;
  markPrice: number;
  exitPrice: number | null;
  floatingReturnBps: number;
  settledReturnBps: number | null;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  simulated: boolean;
};

export type AdminCopyTraderOperationDto = CopyTraderOperationDto & {
  targetReturnBps: number;
  closesAt: string;
  synthetic: boolean;
};

export type CopyTraderStatsPeriod = "TODAY" | "WEEK" | "MONTH" | "ALL";

export type CopyTraderCoinBreakdownDto = {
  symbol: string;
  ops: number;
  shareBps: number;
};

export type CopyTraderDailyPnlDto = {
  date: string;
  returnBps: number;
  ops: number;
};

export type CopyTraderStatsDto = {
  period: CopyTraderStatsPeriod;
  avgReturnBps: number | null;
  opsCount: number;
  winRateBps: number;
  coinBreakdown: CopyTraderCoinBreakdownDto[];
  dailyPnl: CopyTraderDailyPnlDto[];
};

export type CopyTraderCopierDto = {
  /** Masked display name, e.g. SE******3 */
  displayName: string;
  /** Masked wallet fragment when available */
  walletHint: string | null;
  /** Is this row the viewing user? */
  isYou: boolean;
  margin: number;
  pnl: number;
  roiBps: number;
  durationDays: number;
  startedAt: string;
};

export type CopyTraderCopiersDto = {
  total: number;
  maxInvestors: number;
  copiers: CopyTraderCopierDto[];
};

function roiBpsOf(principal: bigint, currentValue: bigint): number {
  if (principal <= 0n) return 0;
  return Number(((currentValue - principal) * 10_000n) / principal);
}

function feeMicro(amount: bigint, bps: number): bigint {
  if (bps <= 0 || amount <= 0n) return 0n;
  return (amount * BigInt(bps)) / 10_000n;
}

function parseFeeUsdtFromNote(note: string | null | undefined): bigint {
  if (!note) return 0n;
  const match = note.match(/fee\s+([0-9]+(?:\.[0-9]+)?)\s+USDT/i);
  if (!match) return 0n;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0n;
  return toMicro(value);
}

function companyFeeFromLedger(row: {
  kind: CopyLedgerKind;
  amount: bigint;
  note?: string | null;
}): bigint {
  if (row.kind === "PERFORMANCE_FEE" || row.kind === "PLATFORM_FEE") {
    return row.amount < 0n ? -row.amount : row.amount;
  }
  return parseFeeUsdtFromNote(row.note);
}

const COMPANY_FEE_LEDGER_WHERE = {
  OR: [
    { kind: "PERFORMANCE_FEE" as const },
    { kind: "PLATFORM_FEE" as const },
    {
      kind: { in: ["INVEST" as const, "WITHDRAWAL" as const] },
      note: { contains: "fee " },
    },
  ],
};

async function chargePlatformOpenFee(
  tx: Prisma.TransactionClient,
  operation: { id: string; traderId: string; leverage: number },
  openFeeBps: number,
): Promise<bigint> {
  const note = platformOpenFeeNote(operation.id);
  const existing = await tx.copyInvestmentLedger.aggregate({
    where: { note },
    _sum: { amount: true },
  });
  const already = existing._sum.amount ?? 0n;
  if (already !== 0n) {
    return already < 0n ? -already : already;
  }

  const investments = await tx.copyInvestment.findMany({
    where: {
      traderId: operation.traderId,
      status: "ACTIVE",
      currentValue: { gt: 0 },
    },
    select: { id: true, currentValue: true },
  });
  let total = 0n;
  for (const investment of investments) {
    const fee = platformOpenFeeMicro(
      investment.currentValue,
      openFeeBps,
    );
    if (fee <= 0n) continue;
    const next =
      investment.currentValue > fee ? investment.currentValue - fee : 0n;
    await tx.copyInvestment.update({
      where: { id: investment.id },
      data: {
        currentValue: next,
        realizedPnl: { decrement: fee },
      },
    });
    await tx.copyInvestmentLedger.create({
      data: {
        investmentId: investment.id,
        kind: "PLATFORM_FEE",
        amount: -fee,
        balanceAfter: next,
        note,
      },
    });
    total += fee;
  }
  if (total > 0n) {
    await tx.copyTrader.update({
      where: { id: operation.traderId },
      data: { aum: { decrement: total } },
    });
  }
  await tx.copyTraderOperation.update({
    where: { id: operation.id },
    data: { platformFeeMicro: total },
  });
  return total;
}

async function stampOperationSettlementFees(
  operationId: string,
  eventId: string | null,
) {
  if (!eventId) {
    await prisma.copyTraderOperation.update({
      where: { id: operationId },
      data: { grossPnlMicro: 0n, performanceFeeMicro: 0n },
    });
    return;
  }
  const ledgers = await prisma.copyInvestmentLedger.findMany({
    where: { performanceId: eventId },
    select: { kind: true, amount: true },
  });
  let gross = 0n;
  let perf = 0n;
  for (const row of ledgers) {
    if (row.kind === "PNL") gross += row.amount;
    if (row.kind === "PERFORMANCE_FEE") {
      perf += row.amount < 0n ? -row.amount : row.amount;
    }
  }
  await prisma.copyTraderOperation.update({
    where: { id: operationId },
    data: { grossPnlMicro: gross, performanceFeeMicro: perf },
  });
}

async function copyNetworkPaidMicro(traderId?: string): Promise<bigint> {
  const result = await prisma.commission.aggregate({
    where: traderId
      ? { copyLedger: { is: { investment: { is: { traderId } } } } }
      : { sourceCopyLedgerId: { not: null } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0n;
}

function serializeTrader(
  t: Prisma.CopyTraderGetPayload<{ include?: { performances?: true } }>,
  opts?: { includePerformances?: boolean },
): CopyTraderDto {
  return {
    id: t.id,
    name: t.name,
    photoUrl: t.photoUrl,
    description: t.description,
    countryCode: t.countryCode,
    countryName: t.countryName,
    riskLevel: t.riskLevel,
    experienceDays: t.experienceDays,
    profitDays: t.profitDays,
    followersCount: t.followersCount,
    investorsCount: Math.max(t.investorsCount, t.showcaseCopiers ?? 0),
    aum: fromMicro(t.aum),
    totalInvested: fromMicro(t.totalInvested),
    roiBps: t.roiBps,
    cumulativeRoiBps: t.cumulativeRoiBps,
    winRateBps: t.winRateBps,
    maxDrawdownBps: t.maxDrawdownBps,
    tradeVolume: fromMicro(t.tradeVolume),
    winningTrades: t.winningTrades,
    losingTrades: t.losingTrades,
    minInvestment: fromMicro(t.minInvestment),
    performanceFeeBps: traderPerformanceFeeBps(t.performanceFeeBps),
    maxInvestors: t.maxInvestors ?? 180,
    isActive: t.isActive,
    isVisible: t.isVisible,
    isFeatured: t.isFeatured,
    sortOrder: t.sortOrder,
    performances:
      opts?.includePerformances &&
      "performances" in t &&
      Array.isArray(t.performances)
        ? t.performances.map((p) => ({
            period: p.period,
            returnBps: p.returnBps,
          }))
        : undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function serializeAdminTrader(
  t: Prisma.CopyTraderGetPayload<{
    include: { _count: { select: { investments: true } } };
  }>,
  extra?: {
    copierPrincipal?: bigint;
    copierValue?: bigint;
    lastReturnBps?: number | null;
    lastReturnAt?: Date | null;
  },
): AdminCopyTraderDto {
  const principal = extra?.copierPrincipal ?? 0n;
  const value = extra?.copierValue ?? 0n;
  return {
    ...serializeTrader(t),
    // Admin views always report the real copier count, never the showcase total.
    investorsCount: t.investorsCount,
    showcaseCopiers: t.showcaseCopiers,
    simulationEnabled: t.simulationEnabled,
    simulationMinBps: t.simulationMinBps,
    simulationMaxBps: t.simulationMaxBps,
    simulationIntervalHours: t.simulationIntervalHours,
    simulationMinOpsPerDay: t.simulationMinOpsPerDay,
    simulationMaxOpsPerDay: t.simulationMaxOpsPerDay,
    simulationDurationMinMinutes: t.simulationDurationMinMinutes,
    simulationDurationMaxMinutes: t.simulationDurationMaxMinutes,
    simulationOpsDayKey: t.simulationOpsDayKey,
    simulationOpsToday: t.simulationOpsToday,
    simulationOpsTarget: t.simulationOpsTarget,
    simulationLastRunAt: t.simulationLastRunAt?.toISOString() ?? null,
    simulationNextRunAt: t.simulationNextRunAt?.toISOString() ?? null,
    nextOperationAt: t.nextOperationAt?.toISOString() ?? null,
    winProbBps: t.winProbBps ?? DEFAULT_WIN_PROB_BPS,
    lossProbBps: t.lossProbBps ?? DEFAULT_LOSS_PROB_BPS,
    targetMode: t.targetMode ?? false,
    monthlyTargetBps: t.monthlyTargetBps ?? 0,
    targetCycleDays: t.targetCycleDays ?? DEFAULT_TARGET_CYCLE_DAYS,
    targetCycleStartedAt: t.targetCycleStartedAt?.toISOString() ?? null,
    activeInvestments: t._count.investments,
    copierPrincipal: fromMicro(principal),
    copierValue: fromMicro(value),
    copierPnl: fromMicro(value - principal),
    lastReturnBps: extra?.lastReturnBps ?? null,
    lastReturnAt: extra?.lastReturnAt?.toISOString() ?? null,
  };
}

function serializeInvestment(inv: InvestmentRow): CopyInvestmentDto {
  return {
    id: inv.id,
    traderId: inv.traderId,
    traderName: inv.trader.name,
    traderRisk: inv.trader.riskLevel,
    traderPhotoUrl: inv.trader.photoUrl,
    traderCountryCode: inv.trader.countryCode,
    traderAum: fromMicro(inv.trader.aum),
    traderRoiBps: inv.trader.roiBps,
    traderWinRateBps: inv.trader.winRateBps,
    investorsCount: inv.trader.investorsCount,
    maxInvestors: inv.trader.maxInvestors,
    principal: fromMicro(inv.principal),
    currentValue: fromMicro(inv.currentValue),
    realizedPnl: fromMicro(inv.realizedPnl),
    roiBps: roiBpsOf(inv.principal, inv.currentValue),
    status: inv.status,
    startedAt: inv.startedAt.getTime(),
  };
}

function serializeWithdrawal(
  w: Prisma.CopyWithdrawalGetPayload<{
    include: { investment: { include: { trader: true } } };
  }>,
): CopyWithdrawalDto {
  return {
    id: w.id,
    investmentId: w.investmentId,
    traderId: w.investment.traderId,
    traderName: w.investment.trader.name,
    amount: fromMicro(w.amount),
    status: w.status,
    requestedAt: w.requestedAt.getTime(),
    processedAt: w.processedAt?.getTime() ?? null,
  };
}

export async function ensureCopyTradingConfig(): Promise<CopyTradingConfigDto> {
  const row = await prisma.copyTradingConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      investFeeBps: DEFAULT_INVEST_FEE_BPS,
      withdrawFeeBps: DEFAULT_WITHDRAW_FEE_BPS,
      copyCashWalletFeeBps: DEFAULT_COPY_CASH_WALLET_FEE_BPS,
      openFeeBps: DEFAULT_OPEN_FEE_BPS,
    },
  });
  return serializeCopyConfig(row);
}

function serializeCopyConfig(row: {
  globalMinInvestment: bigint;
  withdrawalMode: CopyWithdrawalMode;
  notifyOnPerformance: boolean;
  investFeeBps?: number;
  withdrawFeeBps?: number;
  copyCashWalletFeeBps?: number;
  performanceFeeNetworkBps?: number[] | null;
  openFeeBps?: number;
  activeSymbols?: string[] | null;
}): CopyTradingConfigDto {
  return {
    globalMinInvestment: fromMicro(row.globalMinInvestment),
    withdrawalMode: row.withdrawalMode,
    notifyOnPerformance: row.notifyOnPerformance,
    investFeeBps: row.investFeeBps ?? DEFAULT_INVEST_FEE_BPS,
    withdrawFeeBps: row.withdrawFeeBps ?? DEFAULT_WITHDRAW_FEE_BPS,
    copyCashWalletFeeBps:
      row.copyCashWalletFeeBps ?? DEFAULT_COPY_CASH_WALLET_FEE_BPS,
    performanceFeeNetworkBps: normalizePerformanceFeeNetworkBps(
      row.performanceFeeNetworkBps ?? DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
    ),
    openFeeBps: row.openFeeBps ?? DEFAULT_OPEN_FEE_BPS,
    activeSymbols: normalizeActiveSymbols(row.activeSymbols),
  };
}

export async function updateCopyTradingConfig(input: {
  investFeeBps?: number;
  withdrawFeeBps?: number;
  copyCashWalletFeeBps?: number;
  withdrawalMode?: CopyWithdrawalMode;
  globalMinInvestment?: number;
  performanceFeeNetworkBps?: number[];
  openFeeBps?: number;
  activeSymbols?: string[];
}): Promise<CopyTradingConfigDto> {
  await ensureCopyTradingConfig();
  const data: {
    investFeeBps?: number;
    withdrawFeeBps?: number;
    copyCashWalletFeeBps?: number;
    withdrawalMode?: CopyWithdrawalMode;
    globalMinInvestment?: bigint;
    performanceFeeNetworkBps?: number[];
    openFeeBps?: number;
    activeSymbols?: string[];
  } = {};
  if (input.investFeeBps !== undefined) {
    if (!Number.isInteger(input.investFeeBps) || input.investFeeBps < 0 || input.investFeeBps > 2000) {
      throw new CopyTradingError("Invalid invest fee", "INVALID_AMOUNT");
    }
    data.investFeeBps = input.investFeeBps;
  }
  if (input.withdrawFeeBps !== undefined) {
    if (
      !Number.isInteger(input.withdrawFeeBps) ||
      input.withdrawFeeBps < 0 ||
      input.withdrawFeeBps > 2000
    ) {
      throw new CopyTradingError("Invalid withdraw fee", "INVALID_AMOUNT");
    }
    data.withdrawFeeBps = input.withdrawFeeBps;
  }
  if (input.copyCashWalletFeeBps !== undefined) {
    if (
      !Number.isInteger(input.copyCashWalletFeeBps) ||
      input.copyCashWalletFeeBps < 0 ||
      input.copyCashWalletFeeBps > 2000
    ) {
      throw new CopyTradingError("Invalid copy-cash wallet fee", "INVALID_AMOUNT");
    }
    data.copyCashWalletFeeBps = input.copyCashWalletFeeBps;
  }
  if (input.withdrawalMode) data.withdrawalMode = input.withdrawalMode;
  if (input.globalMinInvestment !== undefined) {
    data.globalMinInvestment = toMicro(input.globalMinInvestment);
  }
  if (input.performanceFeeNetworkBps !== undefined) {
    const rates = normalizePerformanceFeeNetworkBps(
      input.performanceFeeNetworkBps,
    );
    const sum = rates.reduce((total, value) => total + value, 0);
    if (sum > 10_000) {
      throw new CopyTradingError(
        "Network shares cannot exceed 100% of the Performance Fee",
        "INVALID_AMOUNT",
      );
    }
    data.performanceFeeNetworkBps = rates;
  }
  if (input.openFeeBps !== undefined) {
    if (
      !Number.isInteger(input.openFeeBps) ||
      input.openFeeBps < 0 ||
      input.openFeeBps > 2000
    ) {
      throw new CopyTradingError("Invalid open fee", "INVALID_AMOUNT");
    }
    data.openFeeBps = input.openFeeBps;
  }
  if (input.activeSymbols !== undefined) {
    const symbols = [
      ...new Set(
        input.activeSymbols
          .map((symbol) => symbol.trim().toUpperCase())
          .filter((symbol) =>
            COPY_MARKETS.some((market) => market.symbol === symbol),
          ),
      ),
    ];
    if (symbols.length === 0) {
      throw new CopyTradingError(
        "At least one active coin is required",
        "INVALID_AMOUNT",
      );
    }
    data.activeSymbols = symbols;
  }
  const row = await prisma.copyTradingConfig.update({
    where: { id: 1 },
    data,
  });
  return serializeCopyConfig(row);
}

export async function listCopyTraders(input?: {
  page?: number;
  pageSize?: number;
}): Promise<{
  traders: CopyTraderDto[];
  page: number;
  pageSize: number;
  total: number;
}> {
  await tickCopyTradingEngine();
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(300, Math.max(1, input?.pageSize ?? 50));
  const where = { isVisible: true, isActive: true };

  const [total, rows] = await Promise.all([
    prisma.copyTrader.count({ where }),
    prisma.copyTrader.findMany({
      where,
      orderBy: [
        { isFeatured: "desc" },
        { sortOrder: "asc" },
        { roiBps: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const operations = await prisma.copyTraderOperation.findMany({
    where: {
      traderId: { in: rows.map((trader) => trader.id) },
      status: "OPEN",
    },
  });
  const operationByTrader = new Map(
    operations.map((operation) => [
      operation.traderId,
      serializeCopyOperation(operation),
    ]),
  );

  return {
    traders: rows.map((trader) => ({
      ...serializeTrader(trader),
      currentOperation: operationByTrader.get(trader.id) ?? null,
    })),
    page,
    pageSize,
    total,
  };
}

export async function getCopyTraderDetail(
  id: string,
): Promise<CopyTraderDetailDto | null> {
  const exists = await prisma.copyTrader.findFirst({
    where: { id, isVisible: true, isActive: true },
    select: { id: true },
  });
  if (!exists) return null;

  await tickCopyTradingEngine();

  // Heal cliffs where a daily result was stored as an absolute curve value.
  await repairTraderChartFromEvents(id);

  const row = await prisma.copyTrader.findFirst({
    where: { id, isVisible: true, isActive: true },
    include: {
      performances: { orderBy: { period: "asc" } },
      chartPoints: { orderBy: { date: "asc" } },
    },
  });
  if (!row) return null;

  const base = serializeTrader(row, { includePerformances: true });
  const open = await prisma.copyTraderOperation.findFirst({
    where: { traderId: id, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
  return {
    ...base,
    currentOperation: open ? serializeCopyOperation(open) : null,
    performances: row.performances.map((p) => ({
      period: p.period,
      returnBps: p.returnBps,
    })),
    chartPoints: row.chartPoints.map((p) => ({
      date: p.date.toISOString().slice(0, 10),
      valueBps: p.valueBps,
    })),
  };
}

export type AdminCopyTraderInput = {
  name: string;
  photoUrl?: string | null;
  description: string;
  riskLevel: CopyRiskLevel;
  experienceDays: number;
  followersCount: number;
  minInvestment: number;
  performanceFeeBps: number;
  maxInvestors: number;
  showcaseCopiers: number;
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder: number;
  simulationEnabled: boolean;
  simulationMinBps: number;
  simulationMaxBps: number;
  simulationIntervalHours?: number;
  simulationMinOpsPerDay: number;
  simulationMaxOpsPerDay: number;
  simulationDurationMinMinutes: number;
  simulationDurationMaxMinutes: number;
  winProbBps?: number;
  lossProbBps?: number;
  targetMode?: boolean;
  monthlyTargetBps?: number;
  targetCycleDays?: number;
};

function validateAdminTraderInput(input: AdminCopyTraderInput): void {
  if (!input.name.trim() || !input.description.trim()) {
    throw new CopyTradingError(
      "Name and description are required",
      "INVALID_AMOUNT",
    );
  }
  if (!Number.isFinite(input.minInvestment) || input.minInvestment < 0) {
    throw new CopyTradingError("Invalid minimum investment", "INVALID_AMOUNT");
  }
  if (
    !Number.isInteger(input.performanceFeeBps) ||
    input.performanceFeeBps < 0 ||
    input.performanceFeeBps > 10_000
  ) {
    throw new CopyTradingError("Invalid performance fee", "INVALID_AMOUNT");
  }
  if (
    !Number.isInteger(input.maxInvestors) ||
    input.maxInvestors < 1 ||
    input.maxInvestors > 1_000_000
  ) {
    throw new CopyTradingError("Invalid max investors", "INVALID_AMOUNT");
  }
  if (
    !Number.isInteger(input.showcaseCopiers) ||
    input.showcaseCopiers < 0 ||
    input.showcaseCopiers > 200 ||
    input.showcaseCopiers > input.maxInvestors
  ) {
    throw new CopyTradingError(
      "Showcase copiers must be between 0 and 200 and cannot exceed max investors",
      "INVALID_AMOUNT",
    );
  }
  if (
    !Number.isInteger(input.simulationMinBps) ||
    !Number.isInteger(input.simulationMaxBps) ||
    input.simulationMinBps < -10_000 ||
    input.simulationMaxBps > 10_000 ||
    input.simulationMinBps > input.simulationMaxBps
  ) {
    throw new CopyTradingError(
      "Invalid simulation return range",
      "INVALID_AMOUNT",
    );
  }
  const intervalHours = input.simulationIntervalHours ?? 24;
  if (
    !Number.isInteger(intervalHours) ||
    intervalHours < 1 ||
    intervalHours > 720
  ) {
    throw new CopyTradingError(
      "Simulation interval must be between 1 and 720 hours",
      "INVALID_AMOUNT",
    );
  }
  if (
    !Number.isInteger(input.simulationMinOpsPerDay) ||
    !Number.isInteger(input.simulationMaxOpsPerDay) ||
    input.simulationMinOpsPerDay < 1 ||
    input.simulationMaxOpsPerDay > 48 ||
    input.simulationMinOpsPerDay > input.simulationMaxOpsPerDay
  ) {
    throw new CopyTradingError(
      "Daily operations must be between 1 and 48",
      "INVALID_AMOUNT",
    );
  }
  if (
    !Number.isInteger(input.simulationDurationMinMinutes) ||
    !Number.isInteger(input.simulationDurationMaxMinutes) ||
    input.simulationDurationMinMinutes < 1 ||
    input.simulationDurationMaxMinutes > 120 ||
    input.simulationDurationMinMinutes > input.simulationDurationMaxMinutes
  ) {
    throw new CopyTradingError(
      "Operation duration must be between 1 and 120 minutes",
      "INVALID_AMOUNT",
    );
  }
  const winProbBps = input.winProbBps ?? DEFAULT_WIN_PROB_BPS;
  const lossProbBps = input.lossProbBps ?? DEFAULT_LOSS_PROB_BPS;
  if (
    !Number.isInteger(winProbBps) ||
    !Number.isInteger(lossProbBps) ||
    winProbBps < 0 ||
    lossProbBps < 0 ||
    winProbBps > 10_000 ||
    lossProbBps > 10_000
  ) {
    throw new CopyTradingError("Invalid win/loss mix", "INVALID_AMOUNT");
  }
  const monthlyTargetBps = input.monthlyTargetBps ?? 0;
  const targetCycleDays = input.targetCycleDays ?? DEFAULT_TARGET_CYCLE_DAYS;
  if (
    !Number.isInteger(monthlyTargetBps) ||
    monthlyTargetBps < -10_000 ||
    monthlyTargetBps > 10_000
  ) {
    throw new CopyTradingError("Invalid monthly target", "INVALID_AMOUNT");
  }
  if (
    !Number.isInteger(targetCycleDays) ||
    targetCycleDays < 1 ||
    targetCycleDays > 90
  ) {
    throw new CopyTradingError("Invalid target cycle", "INVALID_AMOUNT");
  }
}

function targetFieldsFromInput(
  input: AdminCopyTraderInput,
  existing?: {
    targetMode: boolean;
    targetCycleDays: number;
    targetCycleStartedAt: Date | null;
  },
  now = new Date(),
) {
  const targetMode = input.targetMode ?? false;
  const monthlyTargetBps = input.monthlyTargetBps ?? 0;
  const targetCycleDays = input.targetCycleDays ?? DEFAULT_TARGET_CYCLE_DAYS;
  const restart =
    targetMode &&
    (!existing?.targetMode ||
      existing.targetCycleDays !== targetCycleDays ||
      existing.targetCycleStartedAt == null);
  return {
    winProbBps: input.winProbBps ?? DEFAULT_WIN_PROB_BPS,
    lossProbBps: input.lossProbBps ?? DEFAULT_LOSS_PROB_BPS,
    targetMode,
    monthlyTargetBps,
    targetCycleDays,
    targetCycleStartedAt: restart
      ? now
      : targetMode
        ? existing?.targetCycleStartedAt ?? now
        : existing?.targetCycleStartedAt ?? null,
  };
}

export async function listAdminCopyTraders(): Promise<AdminCopyTraderDto[]> {
  const rows = await prisma.copyTrader.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: {
          investments: { where: { status: "ACTIVE" } },
        },
      },
    },
  });
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [agg, lastEvents] = await Promise.all([
    prisma.copyInvestment.groupBy({
      by: ["traderId"],
      where: { traderId: { in: ids }, status: "ACTIVE" },
      _sum: { principal: true, currentValue: true },
    }),
    prisma.copyPerformanceEvent.findMany({
      where: { traderId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: { traderId: true, returnBps: true, createdAt: true },
      take: 500,
    }),
  ]);

  const money = new Map(
    agg.map((row) => [
      row.traderId,
      {
        principal: row._sum.principal ?? 0n,
        value: row._sum.currentValue ?? 0n,
      },
    ]),
  );
  const lastByTrader = new Map<
    string,
    { returnBps: number; createdAt: Date }
  >();
  for (const event of lastEvents) {
    if (!lastByTrader.has(event.traderId)) {
      lastByTrader.set(event.traderId, event);
    }
  }

  return rows.map((row) => {
    const last = lastByTrader.get(row.id);
    const sums = money.get(row.id);
    return serializeAdminTrader(row, {
      copierPrincipal: sums?.principal,
      copierValue: sums?.value,
      lastReturnBps: last?.returnBps ?? null,
      lastReturnAt: last?.createdAt ?? null,
    });
  });
}

export async function createAdminCopyTrader(
  input: AdminCopyTraderInput,
  adminUserId: string,
): Promise<AdminCopyTraderDto> {
  validateAdminTraderInput(input);
  const now = new Date();
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.copyTrader.create({
      data: {
        id: randomUUID(),
        name: input.name.trim(),
        photoUrl: input.photoUrl?.trim() || null,
        description: input.description.trim(),
        riskLevel: input.riskLevel,
        experienceDays: Math.max(0, Math.trunc(input.experienceDays)),
        followersCount: Math.max(0, Math.trunc(input.followersCount)),
        minInvestment: toMicro(input.minInvestment),
        performanceFeeBps: Math.trunc(input.performanceFeeBps),
        maxInvestors: Math.trunc(input.maxInvestors),
        showcaseCopiers: Math.trunc(input.showcaseCopiers),
        isActive: input.isActive,
        isVisible: input.isVisible,
        isFeatured: input.isFeatured,
        sortOrder: Math.trunc(input.sortOrder),
        simulationEnabled: input.simulationEnabled,
        simulationMinBps: input.simulationMinBps,
        simulationMaxBps: input.simulationMaxBps,
        simulationIntervalHours: input.simulationIntervalHours ?? 24,
        simulationMinOpsPerDay: input.simulationMinOpsPerDay,
        simulationMaxOpsPerDay: input.simulationMaxOpsPerDay,
        simulationDurationMinMinutes: input.simulationDurationMinMinutes,
        simulationDurationMaxMinutes: input.simulationDurationMaxMinutes,
        ...targetFieldsFromInput(input, undefined, now),
        simulationNextRunAt: input.simulationEnabled ? now : null,
        nextOperationAt: input.simulationEnabled ? now : null,
      },
    });
    return tx.copyTrader.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        _count: { select: { investments: { where: { status: "ACTIVE" } } } },
      },
    });
  });
  return serializeAdminTrader(row);
}

export async function updateAdminCopyTrader(
  traderId: string,
  input: AdminCopyTraderInput,
  adminUserId: string,
): Promise<AdminCopyTraderDto> {
  validateAdminTraderInput(input);
  const existing = await prisma.copyTrader.findUnique({
    where: { id: traderId },
  });
  if (!existing) throw new CopyTradingError("Trader not found", "NOT_FOUND");
  const now = new Date();

  const row = await prisma.$transaction(async (tx) => {
    await tx.copyTrader.update({
      where: { id: traderId },
      data: {
        name: input.name.trim(),
        photoUrl: input.photoUrl?.trim() || null,
        description: input.description.trim(),
        riskLevel: input.riskLevel,
        experienceDays: Math.max(0, Math.trunc(input.experienceDays)),
        followersCount: Math.max(0, Math.trunc(input.followersCount)),
        minInvestment: toMicro(input.minInvestment),
        performanceFeeBps: Math.trunc(input.performanceFeeBps),
        maxInvestors: Math.trunc(input.maxInvestors),
        showcaseCopiers: Math.trunc(input.showcaseCopiers),
        isActive: input.isActive,
        isVisible: input.isVisible,
        isFeatured: input.isFeatured,
        sortOrder: Math.trunc(input.sortOrder),
        simulationEnabled: input.simulationEnabled,
        simulationMinBps: input.simulationMinBps,
        simulationMaxBps: input.simulationMaxBps,
        simulationIntervalHours: input.simulationIntervalHours ?? 24,
        simulationMinOpsPerDay: input.simulationMinOpsPerDay,
        simulationMaxOpsPerDay: input.simulationMaxOpsPerDay,
        simulationDurationMinMinutes: input.simulationDurationMinMinutes,
        simulationDurationMaxMinutes: input.simulationDurationMaxMinutes,
        ...targetFieldsFromInput(input, existing, now),
        simulationNextRunAt: !input.simulationEnabled
          ? null
          : input.simulationEnabled && !existing.simulationEnabled
            ? now
            : undefined,
        nextOperationAt: !input.simulationEnabled
          ? null
          : input.simulationEnabled && !existing.simulationEnabled
            ? now
            : undefined,
      },
    });
    return tx.copyTrader.findUniqueOrThrow({
      where: { id: traderId },
      include: {
        _count: { select: { investments: { where: { status: "ACTIVE" } } } },
      },
    });
  });
  return serializeAdminTrader(row);
}

export async function updateAdminCopyTraderTarget(
  traderId: string,
  input: {
    targetMode: boolean;
    monthlyTargetBps?: number;
    targetCycleDays?: number;
  },
  adminUserId: string,
): Promise<AdminCopyTraderDto> {
  const existing = await prisma.copyTrader.findUnique({
    where: { id: traderId },
  });
  if (!existing) throw new CopyTradingError("Trader not found", "NOT_FOUND");

  const monthlyTargetBps = input.monthlyTargetBps ?? existing.monthlyTargetBps;
  const targetCycleDays = input.targetCycleDays ?? existing.targetCycleDays;
  if (
    !Number.isInteger(monthlyTargetBps) ||
    monthlyTargetBps < -10_000 ||
    monthlyTargetBps > 10_000
  ) {
    throw new CopyTradingError("Invalid monthly target", "INVALID_AMOUNT");
  }
  if (
    !Number.isInteger(targetCycleDays) ||
    targetCycleDays < 1 ||
    targetCycleDays > 90
  ) {
    throw new CopyTradingError("Invalid target cycle", "INVALID_AMOUNT");
  }

  const now = new Date();
  const restart =
    input.targetMode &&
    (!existing.targetMode ||
      existing.targetCycleDays !== targetCycleDays ||
      existing.targetCycleStartedAt == null);

  const row = await prisma.$transaction(async (tx) => {
    await tx.copyTrader.update({
      where: { id: traderId },
      data: {
        targetMode: input.targetMode,
        monthlyTargetBps,
        targetCycleDays,
        targetCycleStartedAt: restart
          ? now
          : input.targetMode
            ? existing.targetCycleStartedAt ?? now
            : existing.targetCycleStartedAt,
      },
    });
    return tx.copyTrader.findUniqueOrThrow({
      where: { id: traderId },
      include: {
        _count: { select: { investments: { where: { status: "ACTIVE" } } } },
      },
    });
  });
  return serializeAdminTrader(row);
}

export async function updateAdminCopyTraderPerformanceFee(
  traderId: string,
  performanceFeeBps: number,
  _adminUserId: string,
): Promise<AdminCopyTraderDto> {
  const existing = await prisma.copyTrader.findUnique({
    where: { id: traderId },
  });
  if (!existing) throw new CopyTradingError("Trader not found", "NOT_FOUND");

  const nextFee = traderPerformanceFeeBps(performanceFeeBps);
  if (
    !Number.isInteger(performanceFeeBps) ||
    performanceFeeBps < 0 ||
    performanceFeeBps > 10_000
  ) {
    throw new CopyTradingError("Invalid performance fee", "INVALID_AMOUNT");
  }

  const row = await prisma.$transaction(async (tx) => {
    await tx.copyTrader.update({
      where: { id: traderId },
      data: { performanceFeeBps: nextFee },
    });
    return tx.copyTrader.findUniqueOrThrow({
      where: { id: traderId },
      include: {
        _count: { select: { investments: { where: { status: "ACTIVE" } } } },
      },
    });
  });
  return serializeAdminTrader(row);
}

export async function patchAdminCopyTraderFlags(
  traderId: string,
  flags: {
    isFeatured?: boolean;
    isVisible?: boolean;
    isActive?: boolean;
  },
  adminUserId: string,
): Promise<AdminCopyTraderDto> {
  const existing = await prisma.copyTrader.findUnique({
    where: { id: traderId },
  });
  if (!existing) throw new CopyTradingError("Trader not found", "NOT_FOUND");

  const data: {
    isFeatured?: boolean;
    isVisible?: boolean;
    isActive?: boolean;
  } = {};
  if (flags.isFeatured !== undefined) data.isFeatured = flags.isFeatured;
  if (flags.isVisible !== undefined) data.isVisible = flags.isVisible;
  if (flags.isActive !== undefined) data.isActive = flags.isActive;
  if (Object.keys(data).length === 0) {
    throw new CopyTradingError("No flags to update", "INVALID_AMOUNT");
  }

  const row = await prisma.$transaction(async (tx) => {
    await tx.copyTrader.update({ where: { id: traderId }, data });
    return tx.copyTrader.findUniqueOrThrow({
      where: { id: traderId },
      include: {
        _count: { select: { investments: { where: { status: "ACTIVE" } } } },
      },
    });
  });
  return serializeAdminTrader(row);
}

export async function assignShowcaseCopierRange(
  input: { min: number; max: number },
  adminUserId: string,
): Promise<{ updated: number; min: number; max: number }> {
  const min = Math.trunc(input.min);
  const max = Math.trunc(input.max);
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 0 ||
    max > 200 ||
    min > max
  ) {
    throw new CopyTradingError(
      "Displayed copier range must be between 0 and 200",
      "INVALID_AMOUNT",
    );
  }

  const traders = await prisma.copyTrader.findMany({
    select: { id: true, maxInvestors: true },
  });
  if (traders.length === 0) return { updated: 0, min, max };

  const updates = traders.map((trader) =>
    prisma.copyTrader.update({
      where: { id: trader.id },
      data: {
        showcaseCopiers: showcaseCountForTrader(
          trader.id,
          min,
          max,
          trader.maxInvestors,
        ),
      },
      select: { id: true },
    }),
  );
  await prisma.$transaction(updates);

  return { updated: traders.length, min, max };
}

/**
 * Hard-deletes traders. Active copies are refunded to user earnings first,
 * then investments / withdrawals / the trader row are removed.
 */
export async function deleteAdminCopyTraders(
  traderIds: string[],
  adminUserId: string,
): Promise<{ deleted: number; refunded: number; refundedAmount: number }> {
  const uniqueIds = [
    ...new Set(traderIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) {
    throw new CopyTradingError("No traders selected", "INVALID_AMOUNT");
  }
  if (uniqueIds.length > 100) {
    throw new CopyTradingError(
      "Select at most 100 traders at once",
      "INVALID_AMOUNT",
    );
  }

  const result = await prisma.$transaction(
    async (tx) => {
      let deleted = 0;
      let refunded = 0;
      let refundedAmount = 0n;

      for (const traderId of uniqueIds) {
        const trader = await tx.copyTrader.findUnique({
          where: { id: traderId },
        });
        if (!trader) continue;

        const investments = await tx.copyInvestment.findMany({
          where: { traderId },
          select: {
            id: true,
            userId: true,
            currentValue: true,
            status: true,
          },
        });
        const investmentIds = investments.map((row) => row.id);

        for (const inv of investments) {
          if (inv.status !== "ACTIVE" || inv.currentValue <= 0n) continue;
          await tx.user.update({
            where: { id: inv.userId },
            data: { copyCashBalance: { increment: inv.currentValue } },
          });
          await tx.copyInvestmentLedger.create({
            data: {
              investmentId: inv.id,
              kind: "WITHDRAWAL",
              amount: -inv.currentValue,
              balanceAfter: 0n,
              note: "Admin deleted trader — refunded to copy cash",
            },
          });
          refunded += 1;
          refundedAmount += inv.currentValue;
        }

        if (investmentIds.length > 0) {
          await tx.copyWithdrawal.deleteMany({
            where: { investmentId: { in: investmentIds } },
          });
          await tx.copyInvestment.deleteMany({
            where: { id: { in: investmentIds } },
          });
        }

        await tx.copyTrader.delete({ where: { id: traderId } });
        deleted += 1;
      }

      return { deleted, refunded, refundedAmount };
    },
    { maxWait: 15_000, timeout: 60_000 },
  );

  return {
    deleted: result.deleted,
    refunded: result.refunded,
    refundedAmount: fromMicro(result.refundedAmount),
  };
}

export async function listUserCopyInvestments(
  userId: string,
): Promise<CopyInvestmentDto[]> {
  const rows = await prisma.copyInvestment.findMany({
    where: { userId },
    include: { trader: true },
    orderBy: { startedAt: "desc" },
  });
  return rows.map(serializeInvestment);
}

export async function getCopyInvestmentHistory(
  userId: string,
  investmentId: string,
): Promise<CopyInvestmentHistoryDto> {
  const inv = await prisma.copyInvestment.findFirst({
    where: { id: investmentId, userId },
    include: {
      trader: true,
      ledger: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!inv) throw new CopyTradingError("Investment not found", "NOT_FOUND");

  let capitalPlaced = 0n;
  let withdrawn = 0n;
  let gains = 0n;
  let losses = 0n;
  let commissions = 0n;
  const pnlByPerf = new Map<string, bigint>();
  const feeByPerf = new Map<string, bigint>();
  const openFeeByOp = new Map<string, bigint>();
  const openFeePrefix = platformOpenFeeNote("");

  for (const row of inv.ledger) {
    if (row.kind === "INVEST" && row.amount > 0n) capitalPlaced += row.amount;
    if (row.kind === "WITHDRAWAL") {
      withdrawn += row.amount < 0n ? -row.amount : row.amount;
    }
    if (row.kind === "PNL") {
      if (row.amount >= 0n) gains += row.amount;
      else losses += -row.amount;
      if (row.performanceId) {
        pnlByPerf.set(
          row.performanceId,
          (pnlByPerf.get(row.performanceId) ?? 0n) + row.amount,
        );
      }
    }
    const fee = companyFeeFromLedger(row);
    if (fee > 0n) {
      commissions += fee;
      if (row.performanceId) {
        feeByPerf.set(
          row.performanceId,
          (feeByPerf.get(row.performanceId) ?? 0n) + fee,
        );
      }
      if (
        row.kind === "PLATFORM_FEE" &&
        row.note?.startsWith(openFeePrefix)
      ) {
        const opId = row.note.slice(openFeePrefix.length);
        if (opId) {
          openFeeByOp.set(opId, (openFeeByOp.get(opId) ?? 0n) + fee);
        }
      }
    }
  }

  const accumulatedPnl = gains - losses;
  const netResult = accumulatedPnl - commissions;
  const perfIds = [
    ...new Set(
      inv.ledger.flatMap((row) =>
        row.performanceId ? [row.performanceId] : [],
      ),
    ),
  ];

  const opRows =
    perfIds.length > 0
      ? await prisma.copyTraderOperation.findMany({
          where: {
            traderId: inv.traderId,
            performanceEventId: { in: perfIds },
          },
          orderBy: { openedAt: "desc" },
        })
      : [];

  const operations = opRows.map((op) => {
    const eventId = op.performanceEventId;
    const myPnl = eventId ? (pnlByPerf.get(eventId) ?? 0n) : 0n;
    const myFee =
      (eventId ? (feeByPerf.get(eventId) ?? 0n) : 0n) +
      (openFeeByOp.get(op.id) ?? 0n);
    return {
      id: op.id,
      symbol: op.symbol,
      direction: op.direction as "LONG" | "SHORT",
      leverage: op.leverage,
      settledReturnBps: op.settledReturnBps,
      status: op.status as "OPEN" | "CLOSED",
      openedAt: op.openedAt.toISOString(),
      closedAt: op.closedAt?.toISOString() ?? null,
      myPnl: fromMicro(myPnl),
      myFee: fromMicro(myFee),
      myNet: fromMicro(myPnl - myFee),
    };
  });

  return {
    investment: serializeInvestment(inv),
    summary: {
      capitalPlaced: fromMicro(capitalPlaced),
      startedAt: inv.startedAt.getTime(),
      currentValue: fromMicro(inv.currentValue),
      withdrawn: fromMicro(withdrawn),
      gains: fromMicro(gains),
      losses: fromMicro(losses),
      accumulatedPnl: fromMicro(accumulatedPnl),
      commissionsPaid: fromMicro(commissions),
      netResult: fromMicro(netResult),
    },
    operations,
    movements: inv.ledger.map((row) => ({
      id: row.id,
      kind: row.kind,
      amount: fromMicro(row.amount),
      balanceAfter: fromMicro(row.balanceAfter),
      at: row.createdAt.getTime(),
      note: row.note,
    })),
  };
}

export async function listUserCopyEvents(userId: string): Promise<
  Array<{
    id: string;
    traderId: string;
    traderName: string;
    returnBps: number;
    totalDelta: number;
    affected: number;
    at: number;
  }>
> {
  const ledger = await prisma.copyInvestmentLedger.findMany({
    where: {
      kind: "PNL",
      performanceId: { not: null },
      investment: { userId },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { investment: { include: { trader: true } } },
  });
  const eventIds = [
    ...new Set(
      ledger.flatMap((entry) =>
        entry.performanceId ? [entry.performanceId] : [],
      ),
    ),
  ];
  if (eventIds.length === 0) return [];
  const events = await prisma.copyPerformanceEvent.findMany({
    where: { id: { in: eventIds } },
  });
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const grouped = new Map<
    string,
    {
      id: string;
      traderId: string;
      traderName: string;
      returnBps: number;
      totalDeltaMicro: bigint;
      investments: Set<string>;
      at: number;
    }
  >();

  for (const entry of ledger) {
    if (!entry.performanceId) continue;
    const event = eventMap.get(entry.performanceId);
    if (!event) continue;
    const current = grouped.get(event.id) ?? {
      id: event.id,
      traderId: event.traderId,
      traderName: entry.investment.trader.name,
      returnBps: event.returnBps,
      totalDeltaMicro: 0n,
      investments: new Set<string>(),
      at: event.createdAt.getTime(),
    };
    current.totalDeltaMicro += entry.amount;
    current.investments.add(entry.investmentId);
    grouped.set(event.id, current);
  }

  return [...grouped.values()]
    .sort((a, b) => b.at - a.at)
    .slice(0, 50)
    .map((event) => ({
      id: event.id,
      traderId: event.traderId,
      traderName: event.traderName,
      returnBps: event.returnBps,
      totalDelta: fromMicro(event.totalDeltaMicro),
      affected: event.investments.size,
      at: event.at,
    }));
}

export async function listUserCopyWithdrawals(
  userId: string,
): Promise<CopyWithdrawalDto[]> {
  const rows = await prisma.copyWithdrawal.findMany({
    where: { userId },
    include: { investment: { include: { trader: true } } },
    orderBy: { requestedAt: "desc" },
  });
  return rows.map(serializeWithdrawal);
}

export async function investInCopyTrader(input: {
  userId: string;
  traderId: string;
  amount: number;
}): Promise<CopyInvestmentDto> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new CopyTradingError("Invalid amount", "INVALID_AMOUNT");
  }

  const amountMicro = toMicro(input.amount);
  const [config, trader, user] = await Promise.all([
    ensureCopyTradingConfig(),
    prisma.copyTrader.findFirst({
      where: { id: input.traderId, isVisible: true, isActive: true },
    }),
    prisma.user.findUnique({ where: { id: input.userId } }),
  ]);

  if (!trader)
    throw new CopyTradingError("Trader not found", "TRADER_UNAVAILABLE");
  if (!user || !user.isActive)
    throw new CopyTradingError("Account inactive", "INACTIVE");

  const globalMinMicro = toMicro(config.globalMinInvestment);
  const minMicro =
    trader.minInvestment > globalMinMicro
      ? trader.minInvestment
      : globalMinMicro;

  if (amountMicro < minMicro) {
    throw new CopyTradingError("Below minimum investment", "INVALID_AMOUNT");
  }

  const investFee = feeMicro(amountMicro, config.investFeeBps);
  const copiedMicro = amountMicro - investFee;
  if (copiedMicro <= 0n) {
    throw new CopyTradingError("Amount too small after fee", "INVALID_AMOUNT");
  }
  if (user.copyCashBalance < amountMicro) {
    throw new CopyTradingError("Insufficient copy balance", "INSUFFICIENT_BALANCE");
  }

  const investment = await prisma.$transaction(async (tx) => {
    const prior = await tx.copyInvestment.count({
      where: {
        userId: input.userId,
        traderId: input.traderId,
        status: "ACTIVE",
      },
    });

    if (prior === 0) {
      const distinctCopiers = await tx.copyInvestment.findMany({
        where: { traderId: input.traderId, status: "ACTIVE" },
        distinct: ["userId"],
        select: { userId: true },
      });
      if (distinctCopiers.length >= trader.maxInvestors) {
        throw new CopyTradingError(
          "Trader copy slots are full",
          "CAPACITY_FULL",
        );
      }
    }

    const updatedUser = await tx.user.updateMany({
      where: { id: input.userId, copyCashBalance: { gte: amountMicro } },
      data: { copyCashBalance: { decrement: amountMicro } },
    });
    if (updatedUser.count === 0) {
      throw new CopyTradingError(
        "Insufficient copy balance",
        "INSUFFICIENT_BALANCE",
      );
    }

    const existing = await tx.copyInvestment.findFirst({
      where: {
        userId: input.userId,
        traderId: input.traderId,
        status: "ACTIVE",
      },
      orderBy: { startedAt: "desc" },
    });

    if (existing) {
      const toppedUp = await tx.copyInvestment.update({
        where: { id: existing.id },
        data: {
          principal: { increment: copiedMicro },
          currentValue: { increment: copiedMicro },
          status: "ACTIVE",
        },
        include: { trader: true },
      });

      await tx.copyInvestmentLedger.create({
        data: {
          investmentId: toppedUp.id,
          kind: "INVEST",
          amount: copiedMicro,
          balanceAfter: toppedUp.currentValue,
          note:
            investFee > 0n
              ? `Added copy capital (fee ${fromMicro(investFee)} USDT)`
              : "Added copy capital",
        },
      });

      await tx.copyTrader.update({
        where: { id: input.traderId },
        data: {
          aum: { increment: copiedMicro },
          totalInvested: { increment: copiedMicro },
        },
      });

      return toppedUp;
    }

    const created = await tx.copyInvestment.create({
      data: {
        userId: input.userId,
        traderId: input.traderId,
        principal: copiedMicro,
        currentValue: copiedMicro,
        realizedPnl: 0n,
        status: "ACTIVE",
      },
      include: { trader: true },
    });

    await tx.copyInvestmentLedger.create({
      data: {
        investmentId: created.id,
        kind: "INVEST",
        amount: copiedMicro,
        balanceAfter: copiedMicro,
        note:
          investFee > 0n
            ? `Initial copy investment (fee ${fromMicro(investFee)} USDT)`
            : "Initial copy investment",
      },
    });

    await tx.copyTrader.update({
      where: { id: input.traderId },
      data: {
        aum: { increment: copiedMicro },
        totalInvested: { increment: copiedMicro },
        investorsCount: { increment: 1 },
      },
    });

    return created;
  });

  return serializeInvestment(investment);
}

function applyWithdrawalMath(
  principal: bigint,
  currentValue: bigint,
  amountMicro: bigint,
): {
  principal: bigint;
  currentValue: bigint;
  withdrawn: bigint;
  closed: boolean;
} {
  const withdrawn = amountMicro > currentValue ? currentValue : amountMicro;
  if (withdrawn <= 0n) {
    return { principal, currentValue, withdrawn: 0n, closed: false };
  }
  const newCurrent = currentValue - withdrawn;
  const fractionNum = withdrawn;
  const fractionDen = currentValue;
  const newPrincipal = (principal * (fractionDen - fractionNum)) / fractionDen;
  const closed = newCurrent <= 0n;
  return {
    principal: closed ? 0n : newPrincipal,
    currentValue: closed ? 0n : newCurrent,
    withdrawn,
    closed,
  };
}

export async function requestCopyWithdrawal(input: {
  userId: string;
  investmentId: string;
  amount: number;
}): Promise<{ withdrawal: CopyWithdrawalDto; investment: CopyInvestmentDto }> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new CopyTradingError("Invalid amount", "INVALID_AMOUNT");
  }

  const amountMicro = toMicro(input.amount);
  const config = await ensureCopyTradingConfig();

  const result = await prisma.$transaction(async (tx) => {
    const inv = await tx.copyInvestment.findFirst({
      where: { id: input.investmentId, userId: input.userId, status: "ACTIVE" },
      include: { trader: true },
    });
    if (!inv) throw new CopyTradingError("Investment not found", "NOT_FOUND");
    if (inv.currentValue <= 0n)
      throw new CopyTradingError("Nothing to withdraw", "INVALID_AMOUNT");

    const math = applyWithdrawalMath(
      inv.principal,
      inv.currentValue,
      amountMicro,
    );
    if (math.withdrawn <= 0n)
      throw new CopyTradingError("Invalid amount", "INVALID_AMOUNT");

    const now = new Date();
    const withdrawFee = feeMicro(math.withdrawn, config.withdrawFeeBps);
    const credited = math.withdrawn - withdrawFee;

    const withdrawal = await tx.copyWithdrawal.create({
      data: {
        investmentId: inv.id,
        userId: input.userId,
        amount: math.withdrawn,
        status: "COMPLETED",
        processedAt: now,
      },
      include: { investment: { include: { trader: true } } },
    });

      const updatedInv = await tx.copyInvestment.update({
        where: { id: inv.id },
        data: {
          principal: math.principal,
          currentValue: math.currentValue,
          status: math.closed ? "CLOSED" : "ACTIVE",
          closedAt: math.closed ? now : null,
        },
        include: { trader: true },
      });

      await tx.copyInvestmentLedger.create({
        data: {
          investmentId: inv.id,
          kind: "WITHDRAWAL",
          amount: -math.withdrawn,
          balanceAfter: math.currentValue,
        note:
          withdrawFee > 0n
            ? `Copy withdrawal (fee ${fromMicro(withdrawFee)} USDT)`
            : "Instant copy withdrawal",
        },
      });

    if (credited > 0n) {
      await tx.user.update({
        where: { id: input.userId },
        data: { copyCashBalance: { increment: credited } },
      });
    }

      await tx.copyTrader.update({
        where: { id: inv.traderId },
        data: { aum: { decrement: math.withdrawn } },
      });

      return { withdrawal, investment: updatedInv };
  });

  return {
    withdrawal: serializeWithdrawal(result.withdrawal),
    investment: serializeInvestment(result.investment),
  };
}

export async function applyTraderPerformanceUpdate(input: {
  traderId: string;
  period: CopyPeriod;
  returnBps: number;
  adminUserId: string;
  idempotencyKey?: string;
  source?: "ADMIN" | "SIMULATION";
  /** Live close time. Copies that joined by then take this result. */
  eligibleAsOf?: Date;
}): Promise<{
  affected: number;
  totalDelta: number;
  eventId: string;
  alreadyApplied: boolean;
}> {
  if (
    !Number.isInteger(input.returnBps) ||
    input.returnBps < -10_000 ||
    input.returnBps > 10_000
  ) {
    throw new CopyTradingError(
      "returnBps must be an integer",
      "INVALID_AMOUNT",
    );
  }

  const idempotencyKey = input.idempotencyKey?.trim() || randomUUID();
  const prior = await prisma.copyPerformanceEvent.findUnique({
    where: { idempotencyKey },
  });
  if (prior) {
    return {
      affected: 0,
      totalDelta: 0,
      eventId: prior.id,
      alreadyApplied: true,
    };
  }

  let performance: {
    event: { id: string };
    affected: number;
    totalDelta: bigint;
  };
  try {
    performance = await prisma.$transaction(
      async (tx) => {
        const trader = await tx.copyTrader.findUnique({
          where: { id: input.traderId },
        });
        if (!trader)
          throw new CopyTradingError("Trader not found", "NOT_FOUND");

        const event = await tx.copyPerformanceEvent.create({
          data: {
            traderId: input.traderId,
            period: input.period,
            returnBps: input.returnBps,
            source: input.source ?? "ADMIN",
            idempotencyKey,
            createdById: input.adminUserId,
          },
        });

        await tx.copyTraderPerformance.upsert({
          where: {
            traderId_period: { traderId: input.traderId, period: input.period },
          },
          update: { returnBps: { increment: input.returnBps } },
          create: {
            traderId: input.traderId,
            period: input.period,
            returnBps: input.returnBps,
          },
        });
        if (input.period !== "ALL_TIME") {
          await tx.copyTraderPerformance.upsert({
            where: {
              traderId_period: { traderId: input.traderId, period: "ALL_TIME" },
            },
            update: { returnBps: { increment: input.returnBps } },
            create: {
              traderId: input.traderId,
              period: "ALL_TIME",
              returnBps: input.returnBps,
            },
          });
        }

        const copyConfig = await tx.copyTradingConfig.findUnique({
          where: { id: 1 },
        });
        const asOf = input.eligibleAsOf ?? new Date();
        const candidates = await tx.copyInvestment.findMany({
          where: {
            traderId: input.traderId,
            status: "ACTIVE",
            currentValue: { gt: 0 },
            startedAt: { lte: asOf },
          },
        });
        const active = candidates.filter((investment) =>
          eligibleForLiveOperation(investment.startedAt, asOf),
        );

    const syncInput = active.map((i) => ({
      id: i.id,
      principal: i.principal,
      currentValue: i.currentValue,
      realizedPnl: i.realizedPnl,
    }));

        const result = applyPerformanceWithFee(
          syncInput,
          input.returnBps,
          traderPerformanceFeeBps(trader.performanceFeeBps),
        );

    for (const next of result.investments) {
      const closed = next.currentValue <= 0n;
      await tx.copyInvestment.update({
        where: { id: next.id },
        data: {
          currentValue: next.currentValue,
          realizedPnl: next.realizedPnl,
          status: closed ? "CLOSED" : "ACTIVE",
          closedAt: closed ? new Date() : null,
        },
      });
    }

        if (result.pnlLedger.length > 0) {
          await tx.copyInvestmentLedger.createMany({
            data: result.pnlLedger.map((entry) => ({
          investmentId: entry.investmentId,
          kind: "PNL" satisfies CopyLedgerKind,
          amount: entry.amount,
          balanceAfter: entry.balanceAfter,
              performanceId: event.id,
            })),
          });
        }
        if (result.feeLedger.length > 0) {
          await tx.copyInvestmentLedger.createMany({
            data: result.feeLedger.map((entry) => ({
              investmentId: entry.investmentId,
              kind: "PERFORMANCE_FEE" satisfies CopyLedgerKind,
              amount: entry.amount,
              balanceAfter: entry.balanceAfter,
              performanceId: event.id,
              note: `Profit-only performance fee (${(
                traderPerformanceFeeBps(trader.performanceFeeBps) / 100
              ).toFixed(2)}%)`,
            })),
          });
          const feeRows = await tx.copyInvestmentLedger.findMany({
            where: { performanceId: event.id, kind: "PERFORMANCE_FEE" },
            select: {
              id: true,
              amount: true,
              investment: { select: { userId: true } },
            },
          });
          const networkRates = normalizePerformanceFeeNetworkBps(
            copyConfig?.performanceFeeNetworkBps ??
              DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
          );
          for (const row of feeRows) {
            const feeMicro = row.amount < 0n ? -row.amount : row.amount;
            await distributePerformanceFeeNetwork(tx, {
              sourceUserId: row.investment.userId,
              feeLedgerId: row.id,
              feeMicro,
              ratesBps: networkRates,
            });
          }
        }

        // Equity curve is cumulative. Continue from the previous day, then add
        // every result published on this UTC day (never write the daily % alone).
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        const [prevPoint, dayEvents] = await Promise.all([
          tx.copyTraderChartPoint.findFirst({
            where: { traderId: input.traderId, date: { lt: today } },
            orderBy: { date: "desc" },
          }),
          tx.copyPerformanceEvent.findMany({
            where: {
              traderId: input.traderId,
              createdAt: { gte: today, lt: tomorrow },
            },
            select: { returnBps: true },
          }),
        ]);
        const daySum = dayEvents.reduce((sum, row) => sum + row.returnBps, 0);
        const baseBps = prevPoint?.valueBps ?? trader.cumulativeRoiBps;
        const curveBps = baseBps + daySum;

        await tx.copyTraderChartPoint.upsert({
          where: { traderId_date: { traderId: input.traderId, date: today } },
          update: { valueBps: curveBps },
          create: {
            traderId: input.traderId,
            date: today,
            valueBps: curveBps,
          },
        });
        await tx.copyTrader.update({
          where: { id: input.traderId },
          data: {
            roiBps: { increment: input.returnBps },
            cumulativeRoiBps: curveBps,
            aum: { increment: result.totalDelta },
            winningTrades: input.returnBps > 0 ? { increment: 1 } : undefined,
            losingTrades: input.returnBps < 0 ? { increment: 1 } : undefined,
            profitDays: input.returnBps > 0 ? { increment: 1 } : undefined,
          },
        });

        return {
          event,
          affected: active.length,
          totalDelta: result.totalDelta,
        };
      },
      // Distributing P&L touches every active copy; allow room beyond the 5s default.
      { maxWait: 10_000, timeout: 30_000 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const existing = await prisma.copyPerformanceEvent.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          affected: 0,
          totalDelta: 0,
          eventId: existing.id,
          alreadyApplied: true,
        };
      }
    }
    throw error;
  }

  // Heal any older event-days that were stored as absolute daily % instead of cumulative.
  await repairTraderChartFromEvents(input.traderId);

  return {
    affected: performance.affected,
    totalDelta: fromMicro(performance.totalDelta),
    eventId: performance.event.id,
    alreadyApplied: false,
  };
}

/**
 * Rebuild equity-curve points for every UTC day that has performance events.
 * Each day = previous curve point + sum(results that day). Fixes cliffs where a
 * daily % was written as an absolute curve value (e.g. -7% after +165%).
 */
export async function repairTraderChartFromEvents(
  traderId: string,
): Promise<{ fixedDays: number; cumulativeRoiBps: number | null }> {
  const [orphanEvents, closedOps] = await Promise.all([
    prisma.copyPerformanceEvent.findMany({
      where: { traderId, operation: { is: null } },
      orderBy: { createdAt: "asc" },
      select: { returnBps: true, createdAt: true },
    }),
    prisma.copyTraderOperation.findMany({
      where: {
        traderId,
        status: "CLOSED",
        settledReturnBps: { not: null },
      },
      orderBy: { closedAt: "asc" },
      select: { settledReturnBps: true, closedAt: true, openedAt: true },
    }),
  ]);

  const byDay = new Map<string, number>();
  for (const event of orphanEvents) {
    const key = event.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + event.returnBps);
  }
  for (const operation of closedOps) {
    const at = operation.closedAt ?? operation.openedAt;
    const key = at.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + (operation.settledReturnBps ?? 0));
  }
  if (byDay.size === 0) {
    return { fixedDays: 0, cumulativeRoiBps: null };
  }
  const days = [...byDay.keys()].sort();

  let fixedDays = 0;
  let lastValue: number | null = null;

  for (const day of days) {
    const date = new Date(`${day}T00:00:00.000Z`);
    const prev = await prisma.copyTraderChartPoint.findFirst({
      where: { traderId, date: { lt: date } },
      orderBy: { date: "desc" },
      select: { valueBps: true },
    });
    const base = prev?.valueBps ?? 0;
    const next = base + (byDay.get(day) ?? 0);
    await prisma.copyTraderChartPoint.upsert({
      where: { traderId_date: { traderId, date } },
      update: { valueBps: next },
      create: { traderId, date, valueBps: next },
    });
    lastValue = next;
    fixedDays += 1;
  }

  if (lastValue != null) {
    await prisma.copyTrader.update({
      where: { id: traderId },
      data: { cumulativeRoiBps: lastValue },
    });
  }

  return { fixedDays, cumulativeRoiBps: lastValue };
}

async function insertSyntheticOperation(
  traderId: string,
  op: SyntheticHistoryOp,
) {
  await prisma.copyTraderOperation.create({
    data: {
      traderId,
      symbol: op.symbol,
      direction: op.direction,
      leverage: op.leverage,
      entryPrice: op.entryPrice,
      targetReturnBps: op.returnBps,
      exitPrice: op.exitPrice,
      settledReturnBps: op.returnBps,
      status: "CLOSED",
      idempotencyKey: op.idempotencyKey,
      openedAt: op.openedAt,
      closesAt: op.closedAt,
      closedAt: op.closedAt,
      synthetic: true,
    },
  });
}

async function refreshTraderShowcaseFromOps(traderId: string) {
  const closed = await prisma.copyTraderOperation.findMany({
    where: { traderId, status: "CLOSED" },
    select: { settledReturnBps: true, closedAt: true, openedAt: true },
    orderBy: { closedAt: "asc" },
  });
  const winningTrades = closed.filter((row) => (row.settledReturnBps ?? 0) > 0).length;
  const losingTrades = closed.filter((row) => (row.settledReturnBps ?? 0) < 0).length;
  const decided = winningTrades + losingTrades;
  const profitDays = new Set(
    closed
      .filter((row) => (row.settledReturnBps ?? 0) > 0)
      .map((row) => (row.closedAt ?? row.openedAt).toISOString().slice(0, 10)),
  ).size;
  const first = closed[0];
  const last = closed[closed.length - 1];
  const spanDays =
    first && last
      ? Math.max(
          1,
          Math.round(
            ((last.closedAt ?? last.openedAt).getTime() -
              (first.openedAt ?? first.closedAt).getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        )
      : 0;
  const lastReturn = last?.settledReturnBps ?? 0;
  const repaired = await repairTraderChartFromEvents(traderId);
  const existing = await prisma.copyTrader.findUnique({
    where: { id: traderId },
    select: { experienceDays: true },
  });
  await prisma.copyTrader.update({
    where: { id: traderId },
    data: {
      winningTrades,
      losingTrades,
      winRateBps: decided > 0 ? Math.round((winningTrades / decided) * 10_000) : 0,
      profitDays,
      roiBps: lastReturn,
      cumulativeRoiBps: repaired.cumulativeRoiBps ?? 0,
      experienceDays: Math.max(existing?.experienceDays ?? 0, spanDays),
    },
  });
}

export async function generateTraderSyntheticHistory(input: {
  traderId: string;
  months: number;
  bias: HistoryBias;
  adminUserId: string;
}): Promise<{ created: number }> {
  if (!isHistoryBias(input.bias)) {
    throw new CopyTradingError("Invalid history trend", "INVALID_AMOUNT");
  }
  const trader = await prisma.copyTrader.findUnique({
    where: { id: input.traderId },
  });
  if (!trader) throw new CopyTradingError("Trader not found", "NOT_FOUND");
  const config = await ensureCopyTradingConfig();
  const profile = riskProfileOf(trader.riskLevel);
  const ops = buildSyntheticHistoryOps({
    traderId: trader.id,
    months: input.months,
    bias: input.bias,
    now: new Date(),
    minOpsPerDay: trader.simulationMinOpsPerDay,
    maxOpsPerDay: trader.simulationMaxOpsPerDay,
    durationMinMinutes: trader.simulationDurationMinMinutes,
    durationMaxMinutes: trader.simulationDurationMaxMinutes,
    minReturnBps: trader.simulationMinBps,
    maxReturnBps: trader.simulationMaxBps,
    winProbBps: trader.winProbBps,
    lossProbBps: trader.lossProbBps,
    leverageMin: profile.leverageMin,
    leverageMax: profile.leverageMax,
    markets: marketsFromSymbols(config.activeSymbols),
  });
  let created = 0;
  for (const op of ops) {
    try {
      await insertSyntheticOperation(trader.id, op);
      created += 1;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }
  await refreshTraderShowcaseFromOps(trader.id);
  return { created };
}

export async function applyManualTraderHistory(input: {
  traderId: string;
  returnBps: number;
  delayMinutes: number;
  adminUserId: string;
}): Promise<{ scheduled: boolean; executeAt: string; created: number }> {
  if (
    !Number.isInteger(input.returnBps) ||
    input.returnBps === 0 ||
    input.returnBps < -10_000 ||
    input.returnBps > 10_000
  ) {
    throw new CopyTradingError("Enter a result other than 0%", "INVALID_AMOUNT");
  }
  const delayMinutes = Math.max(0, Math.trunc(input.delayMinutes || 0));
  if (delayMinutes > MAX_MANUAL_DELAY_MINUTES) {
    throw new CopyTradingError("Delay cannot exceed 24 hours", "INVALID_AMOUNT");
  }
  const trader = await prisma.copyTrader.findUnique({
    where: { id: input.traderId },
  });
  if (!trader) throw new CopyTradingError("Trader not found", "NOT_FOUND");
  const now = new Date();
  if (delayMinutes > 0) {
    const executeAt = new Date(now.getTime() + delayMinutes * 60_000);
    const row = await prisma.copyScheduledManualResult.create({
      data: {
        traderId: trader.id,
        returnBps: input.returnBps,
        executeAt,
        createdById: input.adminUserId,
      },
    });
    return {
      scheduled: true,
      executeAt: executeAt.toISOString(),
      created: 0,
    };
  }
  await insertManualHistoryNow(trader, input.returnBps, input.adminUserId, now);
  return { scheduled: false, executeAt: now.toISOString(), created: 1 };
}

export async function cancelScheduledManualResult(input: {
  traderId: string;
  actionId: string;
  adminUserId: string;
}): Promise<void> {
  const row = await prisma.copyScheduledManualResult.findFirst({
    where: {
      id: input.actionId,
      traderId: input.traderId,
      canceledAt: null,
      executedAt: null,
    },
  });
  if (!row) throw new CopyTradingError("Scheduled result not found", "NOT_FOUND");
  await prisma.copyScheduledManualResult.update({
    where: { id: row.id },
    data: { canceledAt: new Date() },
  });
}

export async function executeDueScheduledManualResults(
  now = new Date(),
): Promise<number> {
  const due = await prisma.copyScheduledManualResult.findMany({
    where: {
      executeAt: { lte: now },
      canceledAt: null,
      executedAt: null,
    },
    include: { trader: true },
    take: 50,
  });
  let executed = 0;
  for (const row of due) {
    await insertManualHistoryNow(
      row.trader,
      row.returnBps,
      row.createdById,
      now,
      row.id,
    );
    await prisma.copyScheduledManualResult.update({
      where: { id: row.id },
      data: { executedAt: now },
    });
    executed += 1;
  }
  return executed;
}

async function insertManualHistoryNow(
  trader: Prisma.CopyTraderGetPayload<object>,
  returnBps: number,
  adminUserId: string,
  now: Date,
  nonce?: string,
) {
  const config = await ensureCopyTradingConfig();
  const profile = riskProfileOf(trader.riskLevel);
  const op = buildManualHistoryOp({
    traderId: trader.id,
    returnBps,
    now,
    durationMinMinutes: trader.simulationDurationMinMinutes,
    durationMaxMinutes: trader.simulationDurationMaxMinutes,
    leverageMin: profile.leverageMin,
    leverageMax: profile.leverageMax,
    markets: marketsFromSymbols(config.activeSymbols),
    nonce,
  });
  await insertSyntheticOperation(trader.id, op);
  await refreshTraderShowcaseFromOps(trader.id);
}

export async function getAdminCopyDashboard() {
  const [
    config,
    traders,
    activeAggregate,
    activeUsers,
    pendingRows,
    recentRows,
    openOperations,
    feeRows,
    networkPaid,
  ] = await Promise.all([
    ensureCopyTradingConfig(),
    listAdminCopyTraders(),
    prisma.copyInvestment.aggregate({
      where: { status: "ACTIVE" },
      _count: true,
      _sum: { principal: true, currentValue: true },
    }),
    prisma.copyInvestment.groupBy({
      by: ["userId"],
      where: { status: "ACTIVE" },
    }),
    prisma.copyWithdrawal.findMany({
      where: { status: "REQUESTED" },
      orderBy: { requestedAt: "asc" },
      take: 50,
      include: {
        user: { select: { walletAddress: true, username: true } },
        investment: { include: { trader: true } },
      },
    }),
    prisma.copyPerformanceEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { trader: { select: { name: true } } },
    }),
    prisma.copyTraderOperation.findMany({
      where: { status: "OPEN" },
      orderBy: { openedAt: "desc" },
    }),
    prisma.copyInvestmentLedger.findMany({
      where: COMPANY_FEE_LEDGER_WHERE,
      select: { kind: true, amount: true, note: true },
    }),
    copyNetworkPaidMicro(),
  ]);

  const principal = activeAggregate._sum.principal ?? 0n;
  const currentValue = activeAggregate._sum.currentValue ?? 0n;
  const grossFees = feeRows.reduce(
    (sum, row) => sum + companyFeeFromLedger(row),
    0n,
  );
  const companyFees = grossFees > networkPaid ? grossFees - networkPaid : 0n;
  return {
    config,
    metrics: {
      traders: traders.length,
      activeTraders: traders.filter((t) => t.isActive && t.isVisible).length,
      automatedTraders: traders.filter((t) => t.simulationEnabled).length,
      activeInvestments: activeAggregate._count,
      activeUsers: activeUsers.length,
      totalPrincipal: fromMicro(principal),
      currentValue: fromMicro(currentValue),
      totalPnl: fromMicro(currentValue - principal),
      companyFees: fromMicro(companyFees),
      networkCommissions: fromMicro(networkPaid),
      pendingWithdrawals: pendingRows.length,
    },
    traders,
    openOperations: openOperations.map((operation) =>
      serializeCopyOperation(operation, undefined, { forAdmin: true }),
    ),
    pendingWithdrawals: pendingRows.map((w) => ({
      id: w.id,
      investmentId: w.investmentId,
      traderName: w.investment.trader.name,
      userName: w.user.username || w.user.walletAddress,
      walletAddress: w.user.walletAddress,
      amount: fromMicro(w.amount),
      requestedAt: w.requestedAt.toISOString(),
    })),
    recentEvents: recentRows.map((event): CopyPerformanceEventDto => ({
      id: event.id,
      traderId: event.traderId,
      traderName: event.trader.name,
      period: event.period,
      returnBps: event.returnBps,
      source: event.source,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export type CopyLivePeriodStats = {
  avgBps: number;
  count: number;
};

export type CopyLiveTraderStatus =
  | {
      kind: "OPEN";
      symbol: string;
      direction: "LONG" | "SHORT";
      leverage: number;
      openedAt: string;
      closesAt: string;
      targetReturnBps: number;
      floatingReturnBps: number;
    }
  | { kind: "NEXT"; nextAt: string }
  | { kind: "RESTING"; nextAt: string }
  | { kind: "DUE" };

export type CopyLiveClosedFeeRow = {
  id: string;
  traderId: string;
  traderName: string;
  symbol: string;
  settledReturnBps: number;
  platformFee: number;
  performanceFee: number;
  closedAt: string;
};

export type CopyLiveTraderRow = {
  id: string;
  name: string;
  isActive: boolean;
  capital: number;
  today: CopyLivePeriodStats;
  week: CopyLivePeriodStats;
  month: CopyLivePeriodStats;
  all: CopyLivePeriodStats;
  platformFees: number;
  performanceFees: number;
  opsToday: number;
  opsTarget: number;
  status: CopyLiveTraderStatus;
  target: {
    enabled: boolean;
    targetBps: number;
    cycleDays: number;
    startedAt: string | null;
    elapsedDays: number;
    dayIndex: number;
    progressBps: number;
    expectedBps: number;
  };
};

export type AdminCopyLiveBoardDto = {
  generatedAt: string;
  summary: {
    platformFees: number;
    performanceFees: number;
    networkPaid: number;
    companyKept: number;
    totalIncome: number;
    grossPositive: number;
    grossNegative: number;
    netGross: number;
    realDeposits: number;
    connectedCapital: number;
    tradersWithFee: number;
    traders: number;
    openFeeBps: number;
    activeSymbols: string[];
    markets: Array<{ symbol: string; short: string }>;
  };
  openOperations: Array<
    AdminCopyTraderOperationDto & {
      traderName: string;
      platformFee: number;
    }
  >;
  closedFees: CopyLiveClosedFeeRow[];
  traders: CopyLiveTraderRow[];
};

function periodReturnStats(
  ops: Array<{ settledReturnBps: number | null; closedAt: Date | null }>,
  since: Date | null,
): CopyLivePeriodStats {
  const filtered = ops.filter((op) => {
    if (since == null) return true;
    return op.closedAt != null && op.closedAt.getTime() >= since.getTime();
  });
  if (filtered.length === 0) return { avgBps: 0, count: 0 };
  const sum = filtered.reduce(
    (total, op) => total + (op.settledReturnBps ?? 0),
    0,
  );
  return { avgBps: Math.round(sum / filtered.length), count: filtered.length };
}

function liveTraderStatus(
  trader: {
    simulationOpsToday: number;
    simulationOpsTarget: number;
    nextOperationAt: Date | null;
  },
  open: Prisma.CopyTraderOperationGetPayload<object> | undefined,
  now: Date,
): CopyLiveTraderStatus {
  if (open) {
    return {
      kind: "OPEN",
      symbol: open.symbol,
      direction: open.direction as "LONG" | "SHORT",
      leverage: open.leverage,
      openedAt: open.openedAt.toISOString(),
      closesAt: open.closesAt.toISOString(),
      targetReturnBps: open.targetReturnBps,
      floatingReturnBps: serializeCopyOperation(open, now, { forAdmin: true })
        .floatingReturnBps,
    };
  }
  if (trader.simulationOpsToday >= trader.simulationOpsTarget) {
    return { kind: "RESTING", nextAt: utcNextDayStart(now).toISOString() };
  }
  if (
    trader.nextOperationAt &&
    trader.nextOperationAt.getTime() > now.getTime()
  ) {
    return { kind: "NEXT", nextAt: trader.nextOperationAt.toISOString() };
  }
  return { kind: "DUE" };
}

export async function getAdminCopyLiveBoard(): Promise<AdminCopyLiveBoardDto> {
  await tickCopyTradingEngine();
  const now = new Date();
  const todayStart = utcDayStart(now);
  const dayKey = todayStart.toISOString().slice(0, 10);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    config,
    traders,
    openRows,
    closedRows,
    capitalGroups,
    platformLedger,
    performanceLedger,
    investLedger,
    networkPaid,
  ] = await Promise.all([
    ensureCopyTradingConfig(),
    prisma.copyTrader.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
        performanceFeeBps: true,
        simulationOpsToday: true,
        simulationOpsTarget: true,
        simulationOpsDayKey: true,
        nextOperationAt: true,
        targetMode: true,
        monthlyTargetBps: true,
        targetCycleDays: true,
        targetCycleStartedAt: true,
      },
    }),
    prisma.copyTraderOperation.findMany({
      where: { status: "OPEN" },
      include: { trader: { select: { name: true } } },
      orderBy: { openedAt: "desc" },
    }),
    prisma.copyTraderOperation.findMany({
      where: { status: "CLOSED" },
      include: { trader: { select: { name: true } } },
      orderBy: { closedAt: "desc" },
    }),
    prisma.copyInvestment.groupBy({
      by: ["traderId"],
      where: { status: "ACTIVE" },
      _sum: { currentValue: true },
    }),
    prisma.copyInvestmentLedger.aggregate({
      where: { kind: "PLATFORM_FEE" },
      _sum: { amount: true },
    }),
    prisma.copyInvestmentLedger.aggregate({
      where: { kind: "PERFORMANCE_FEE" },
      _sum: { amount: true },
    }),
    prisma.copyInvestmentLedger.aggregate({
      where: { kind: "INVEST" },
      _sum: { amount: true },
    }),
    copyNetworkPaidMicro(),
  ]);

  const absFee = (amount: bigint | null | undefined) => {
    const value = amount ?? 0n;
    return value < 0n ? -value : value;
  };
  const platformFees = absFee(platformLedger._sum.amount);
  const performanceFees = absFee(performanceLedger._sum.amount);
  const companyKeptPerf =
    performanceFees > networkPaid ? performanceFees - networkPaid : 0n;

  let grossPositive = 0n;
  let grossNegative = 0n;
  const closedByTrader = new Map<
    string,
    Array<{
      settledReturnBps: number | null;
      closedAt: Date | null;
      platformFeeMicro: bigint;
      performanceFeeMicro: bigint;
      synthetic: boolean;
    }>
  >();
  for (const op of closedRows) {
    if (op.grossPnlMicro > 0n) grossPositive += op.grossPnlMicro;
    else if (op.grossPnlMicro < 0n) grossNegative += op.grossPnlMicro;
    const list = closedByTrader.get(op.traderId) ?? [];
    list.push({
      settledReturnBps: op.settledReturnBps,
      closedAt: op.closedAt,
      platformFeeMicro: op.platformFeeMicro,
      performanceFeeMicro: op.performanceFeeMicro,
      synthetic: op.synthetic,
    });
    closedByTrader.set(op.traderId, list);
  }

  const capitalByTrader = new Map(
    capitalGroups.map((row) => [row.traderId, row._sum.currentValue ?? 0n]),
  );
  const openByTrader = new Map(openRows.map((row) => [row.traderId, row]));
  const connectedCapital = capitalGroups.reduce(
    (sum, row) => sum + (row._sum.currentValue ?? 0n),
    0n,
  );

  return {
    generatedAt: now.toISOString(),
    summary: {
      platformFees: fromMicro(platformFees),
      performanceFees: fromMicro(performanceFees),
      networkPaid: fromMicro(networkPaid),
      companyKept: fromMicro(platformFees + companyKeptPerf),
      totalIncome: fromMicro(platformFees + performanceFees),
      grossPositive: fromMicro(grossPositive),
      grossNegative: fromMicro(grossNegative),
      netGross: fromMicro(grossPositive + grossNegative),
      realDeposits: fromMicro(investLedger._sum.amount ?? 0n),
      connectedCapital: fromMicro(connectedCapital),
      tradersWithFee: traders.filter((trader) => trader.performanceFeeBps > 0)
        .length,
      traders: traders.length,
      openFeeBps: config.openFeeBps,
      activeSymbols: config.activeSymbols,
      markets: COPY_MARKETS.map((market) => ({
        symbol: market.symbol,
        short: market.short,
      })),
    },
    openOperations: openRows.map((operation) => ({
      ...serializeCopyOperation(operation, now, { forAdmin: true }),
      traderName: operation.trader.name,
      platformFee: fromMicro(operation.platformFeeMicro),
    })),
    closedFees: closedRows
      .filter((operation) => !operation.synthetic)
      .slice(0, 40)
      .map((operation) => ({
      id: operation.id,
      traderId: operation.traderId,
      traderName: operation.trader.name,
      symbol: operation.symbol,
      settledReturnBps: operation.settledReturnBps ?? 0,
      platformFee: fromMicro(operation.platformFeeMicro),
      performanceFee: fromMicro(operation.performanceFeeMicro),
      closedAt: operation.closedAt?.toISOString() ?? operation.openedAt.toISOString(),
    })),
    traders: traders.map((trader) => {
      const closed = closedByTrader.get(trader.id) ?? [];
      const liveClosed = closed.filter((op) => !op.synthetic);
      const open = openByTrader.get(trader.id);
      const opsTodayClosed = liveClosed.filter(
        (op) => op.closedAt != null && op.closedAt >= todayStart,
      ).length;
      const opsToday =
        trader.simulationOpsDayKey === dayKey
          ? Math.max(
              trader.simulationOpsToday,
              opsTodayClosed + (open ? 1 : 0),
            )
          : opsTodayClosed + (open ? 1 : 0);
      const platformSum = liveClosed.reduce(
        (sum, op) => sum + op.platformFeeMicro,
        0n,
      ) + (open?.platformFeeMicro ?? 0n);
      const perfSum = liveClosed.reduce(
        (sum, op) => sum + op.performanceFeeMicro,
        0n,
      );
      return {
        id: trader.id,
        name: trader.name,
        isActive: trader.isActive,
        capital: fromMicro(capitalByTrader.get(trader.id) ?? 0n),
        today: periodReturnStats(closed, todayStart),
        week: periodReturnStats(closed, weekStart),
        month: periodReturnStats(closed, monthStart),
        all: periodReturnStats(closed, null),
        platformFees: fromMicro(platformSum),
        performanceFees: fromMicro(perfSum),
        opsToday,
        opsTarget: trader.simulationOpsTarget,
        status: liveTraderStatus(
          {
            simulationOpsToday: opsToday,
            simulationOpsTarget: trader.simulationOpsTarget,
            nextOperationAt: trader.nextOperationAt,
          },
          open,
          now,
        ),
        target: targetProgressSnapshot({
          enabled: trader.targetMode,
          targetBps: trader.monthlyTargetBps,
          cycleDays: trader.targetCycleDays,
          startedAt: trader.targetCycleStartedAt,
          progressBps: trader.targetMode
            ? liveClosed
                .filter((op) => {
                  const start = resolveTargetCycleStart(
                    trader.targetCycleStartedAt,
                    trader.targetCycleDays,
                    now,
                  );
                  return op.closedAt != null && op.closedAt >= start;
                })
                .reduce((sum, op) => sum + (op.settledReturnBps ?? 0), 0)
            : 0,
          now,
        }),
      };
    }),
  };
}

export type AdminCopyTraderDeskDto = {
  trader: AdminCopyTraderDto;
  config: CopyTradingConfigDto;
  situation: {
    activeCopies: number;
    principal: number;
    currentValue: number;
    pnl: number;
    companyFees: number;
    networkCommissions: number;
  };
  /** Same numbers the mobile public profile / performance tab show. */
  publicFacing: {
    aum: number;
    totalInvested: number;
    performanceFeeBps: number;
    investorsCount: number;
    maxInvestors: number;
    roiBps: number;
    cumulativeRoiBps: number;
    winRateBps: number;
    avgReturnBps: number | null;
    opsCount: number;
    periodWinRateBps: number;
    curve7dReturnBps: number | null;
  };
  copiers: Array<{
    investmentId: string;
    userId: string;
    username: string | null;
    walletAddress: string;
    principal: number;
    currentValue: number;
    pnl: number;
    roiBps: number;
    startedAt: string;
  }>;
  operations: AdminCopyTraderOperationDto[];
  liveSchedule: {
    enabled: boolean;
    opsToday: number;
    opsTarget: number;
    minOpsPerDay: number;
    maxOpsPerDay: number;
    durationMinMinutes: number;
    durationMaxMinutes: number;
    nextOperationAt: string | null;
    currentClosesAt: string | null;
    currentOperationId: string | null;
    currentTargetReturnBps: number | null;
    currentFloatingReturnBps: number | null;
  };
  target: {
    enabled: boolean;
    targetBps: number;
    cycleDays: number;
    startedAt: string | null;
    elapsedDays: number;
    dayIndex: number;
    progressBps: number;
    expectedBps: number;
  };
  scheduledManual: Array<{
    id: string;
    returnBps: number;
    executeAt: string;
    createdAt: string;
  }>;
};

export async function listAdminCopyCopiers(): Promise<{
  total: number;
  winning: number;
  losing: number;
  principal: number;
  currentValue: number;
  pnl: number;
  copiers: Array<{
    investmentId: string;
    userId: string;
    username: string | null;
    walletAddress: string;
    traderId: string;
    traderName: string;
    principal: number;
    currentValue: number;
    pnl: number;
    roiBps: number;
    startedAt: string;
  }>;
}> {
  const rows = await prisma.copyInvestment.findMany({
    where: { status: "ACTIVE" },
    include: {
      user: { select: { id: true, username: true, walletAddress: true } },
      trader: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 500,
  });

  let principal = 0n;
  let currentValue = 0n;
  let winning = 0;
  let losing = 0;
  const copiers = rows.map((row) => {
    principal += row.principal;
    currentValue += row.currentValue;
    const pnlMicro = row.currentValue - row.principal;
    if (pnlMicro > 0n) winning += 1;
    if (pnlMicro < 0n) losing += 1;
    return {
      investmentId: row.id,
      userId: row.userId,
      username: row.user.username,
      walletAddress: row.user.walletAddress,
      traderId: row.traderId,
      traderName: row.trader.name,
      principal: fromMicro(row.principal),
      currentValue: fromMicro(row.currentValue),
      pnl: fromMicro(pnlMicro),
      roiBps: roiBpsOf(row.principal, row.currentValue),
      startedAt: row.startedAt.toISOString(),
    };
  });

  return {
    total: copiers.length,
    winning,
    losing,
    principal: fromMicro(principal),
    currentValue: fromMicro(currentValue),
    pnl: fromMicro(currentValue - principal),
    copiers,
  };
}

export async function listAdminUserCopyInvestments(userId: string): Promise<{
  summary: {
    active: number;
    principal: number;
    currentValue: number;
    pnl: number;
    copyCashBalance: number;
  };
  investments: Array<{
    id: string;
    traderId: string;
    traderName: string;
    status: CopyInvestmentStatus;
    principal: number;
    currentValue: number;
    pnl: number;
    roiBps: number;
    startedAt: string;
    closedAt: string | null;
  }>;
}> {
  const [user, rows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { copyCashBalance: true },
    }),
    prisma.copyInvestment.findMany({
    where: { userId },
    include: { trader: { select: { id: true, name: true } } },
    orderBy: { startedAt: "desc" },
    take: 100,
    }),
  ]);

  const activeRows = rows.filter((row) => row.status === "ACTIVE");
  const principal = activeRows.reduce((sum, row) => sum + row.principal, 0n);
  const currentValue = activeRows.reduce(
    (sum, row) => sum + row.currentValue,
    0n,
  );

  return {
    summary: {
      active: activeRows.length,
      principal: fromMicro(principal),
      currentValue: fromMicro(currentValue),
      pnl: fromMicro(currentValue - principal),
      copyCashBalance: fromMicro(user?.copyCashBalance ?? 0n),
    },
    investments: rows.map((row) => ({
      id: row.id,
      traderId: row.traderId,
      traderName: row.trader.name,
      status: row.status,
      principal: fromMicro(row.principal),
      currentValue: fromMicro(row.currentValue),
      pnl: fromMicro(row.currentValue - row.principal),
      roiBps: roiBpsOf(row.principal, row.currentValue),
      startedAt: row.startedAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
    })),
  };
}

export async function getAdminCopyTraderDesk(
  traderId: string,
): Promise<AdminCopyTraderDeskDto> {
  const exists = await prisma.copyTrader.findUnique({
    where: { id: traderId },
    select: { id: true },
  });
  if (!exists) throw new CopyTradingError("Trader not found", "NOT_FOUND");

  await tickCopyTradingEngine();
  await repairTraderChartFromEvents(traderId);

  const trader = await prisma.copyTrader.findUnique({
    where: { id: traderId },
    include: {
      _count: { select: { investments: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!trader) throw new CopyTradingError("Trader not found", "NOT_FOUND");

  const config = await ensureCopyTradingConfig();

  const [active, chartPoints, operations, feeRows, weekStats, networkPaid, cycleSum, scheduledManual] =
    await Promise.all([
    prisma.copyInvestment.findMany({
      where: { traderId, status: "ACTIVE" },
      include: {
        user: { select: { id: true, username: true, walletAddress: true } },
      },
      orderBy: { startedAt: "asc" },
    }),
    prisma.copyTraderChartPoint.findMany({
      where: { traderId },
      orderBy: { date: "desc" },
      take: 180,
    }),
    prisma.copyTraderOperation.findMany({
      where: { traderId },
      orderBy: [{ status: "desc" }, { openedAt: "desc" }],
      take: 80,
    }),
    prisma.copyInvestmentLedger.findMany({
      where: {
        ...COMPANY_FEE_LEDGER_WHERE,
        investment: { traderId },
      },
      select: { kind: true, amount: true, note: true },
    }),
    getCopyTraderStats(traderId, "WEEK", { requireVisible: false }),
    copyNetworkPaidMicro(traderId),
    trader.targetMode
      ? prisma.copyTraderOperation.aggregate({
          where: {
            traderId,
            status: "CLOSED",
            synthetic: false,
            closedAt: {
              gte: resolveTargetCycleStart(
                trader.targetCycleStartedAt,
                trader.targetCycleDays,
                new Date(),
              ),
            },
          },
          _sum: { settledReturnBps: true },
        })
      : Promise.resolve({ _sum: { settledReturnBps: null } }),
    prisma.copyScheduledManualResult.findMany({
      where: { traderId, canceledAt: null, executedAt: null },
      orderBy: { executeAt: "asc" },
    }),
  ]);

  const principal = active.reduce((sum, row) => sum + row.principal, 0n);
  const currentValue = active.reduce((sum, row) => sum + row.currentValue, 0n);
  const grossFees = feeRows.reduce(
    (sum, row) => sum + companyFeeFromLedger(row),
    0n,
  );
  const companyFees = grossFees > networkPaid ? grossFees - networkPaid : 0n;
  const now = new Date();

  const chartAsc = [...chartPoints]
    .map((point) => ({
      date: point.date.toISOString().slice(0, 10),
      valueBps: point.valueBps,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const weekAgo = new Date(now);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const weekKey = weekAgo.toISOString().slice(0, 10);
  const curveWindow = chartAsc.filter((point) => point.date >= weekKey);
  const curve7dReturnBps =
    curveWindow.length >= 2
      ? curveWindow[curveWindow.length - 1]!.valueBps - curveWindow[0]!.valueBps
      : chartAsc.length >= 2
        ? chartAsc[chartAsc.length - 1]!.valueBps - chartAsc[0]!.valueBps
        : null;

  const serialized = serializeAdminTrader(trader);
  const serializedOps = operations.map((operation) =>
    serializeCopyOperation(operation, now, { forAdmin: true }),
  );
  const openSerialized =
    serializedOps.find((operation) => operation.status === "OPEN") ?? null;

  return {
    trader: serialized,
    config,
    situation: {
      activeCopies: active.length,
      principal: fromMicro(principal),
      currentValue: fromMicro(currentValue),
      pnl: fromMicro(currentValue - principal),
      companyFees: fromMicro(companyFees),
      networkCommissions: fromMicro(networkPaid),
    },
    publicFacing: {
      aum: serialized.aum,
      totalInvested: serialized.totalInvested,
      performanceFeeBps: traderPerformanceFeeBps(serialized.performanceFeeBps),
      investorsCount: serialized.investorsCount,
      maxInvestors: serialized.maxInvestors ?? 180,
      roiBps: serialized.roiBps,
      cumulativeRoiBps: serialized.cumulativeRoiBps,
      winRateBps: serialized.winRateBps,
      avgReturnBps: weekStats?.avgReturnBps ?? null,
      opsCount: weekStats?.opsCount ?? 0,
      periodWinRateBps: weekStats?.winRateBps ?? 0,
      curve7dReturnBps,
    },
    copiers: active.map((row) => ({
      investmentId: row.id,
      userId: row.userId,
      username: row.user.username,
      walletAddress: row.user.walletAddress,
      principal: fromMicro(row.principal),
      currentValue: fromMicro(row.currentValue),
      pnl: fromMicro(row.currentValue - row.principal),
      roiBps: roiBpsOf(row.principal, row.currentValue),
      startedAt: row.startedAt.toISOString(),
    })),
    operations: serializedOps,
    liveSchedule: {
      enabled: trader.simulationEnabled,
      opsToday: trader.simulationOpsToday,
      opsTarget: trader.simulationOpsTarget,
      minOpsPerDay: trader.simulationMinOpsPerDay,
      maxOpsPerDay: trader.simulationMaxOpsPerDay,
      durationMinMinutes: trader.simulationDurationMinMinutes,
      durationMaxMinutes: trader.simulationDurationMaxMinutes,
      nextOperationAt: trader.nextOperationAt?.toISOString() ?? null,
      currentClosesAt: openSerialized?.closesAt ?? null,
      currentOperationId: openSerialized?.id ?? null,
      currentTargetReturnBps: openSerialized?.targetReturnBps ?? null,
      currentFloatingReturnBps: openSerialized?.floatingReturnBps ?? null,
    },
    target: targetProgressSnapshot({
      enabled: trader.targetMode,
      targetBps: trader.monthlyTargetBps,
      cycleDays: trader.targetCycleDays,
      startedAt: trader.targetCycleStartedAt,
      progressBps: cycleSum._sum.settledReturnBps ?? 0,
      now,
    }),
    scheduledManual: scheduledManual.map((row) => ({
      id: row.id,
      returnBps: row.returnBps,
      executeAt: row.executeAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function updateAdminTraderVitrina(
  traderId: string,
  input: {
    roiBps: number;
    cumulativeRoiBps: number;
    winRateBps: number;
    maxDrawdownBps: number;
    profitDays: number;
    winningTrades: number;
    losingTrades: number;
    experienceDays: number;
    followersCount: number;
  },
  adminUserId: string,
): Promise<AdminCopyTraderDto> {
  const existing = await prisma.copyTrader.findUnique({
    where: { id: traderId },
  });
  if (!existing) throw new CopyTradingError("Trader not found", "NOT_FOUND");

  const clampInt = (value: number, min: number, max: number) => {
    if (!Number.isInteger(value)) {
      throw new CopyTradingError("Invalid stats value", "INVALID_AMOUNT");
    }
    if (value < min || value > max) {
      throw new CopyTradingError("Invalid stats value", "INVALID_AMOUNT");
    }
    return value;
  };

  const row = await prisma.$transaction(async (tx) => {
    await tx.copyTrader.update({
      where: { id: traderId },
      data: {
        roiBps: clampInt(input.roiBps, -1_000_000, 1_000_000),
        cumulativeRoiBps: clampInt(input.cumulativeRoiBps, -1_000_000, 1_000_000),
        winRateBps: clampInt(input.winRateBps, 0, 10_000),
        maxDrawdownBps: clampInt(input.maxDrawdownBps, 0, 10_000),
        profitDays: clampInt(input.profitDays, 0, 36_500),
        winningTrades: clampInt(input.winningTrades, 0, 1_000_000),
        losingTrades: clampInt(input.losingTrades, 0, 1_000_000),
        experienceDays: clampInt(input.experienceDays, 0, 36_500),
        followersCount: clampInt(input.followersCount, 0, 1_000_000_000),
      },
    });
    return tx.copyTrader.findUniqueOrThrow({
      where: { id: traderId },
      include: {
        _count: { select: { investments: { where: { status: "ACTIVE" } } } },
      },
    });
  });
  return serializeAdminTrader(row);
}

export type AdminCopyOperationInput = {
  symbol: string;
  direction: "LONG" | "SHORT";
  leverage: number;
  entryPrice: number;
  targetReturnBps: number;
  status: "OPEN" | "CLOSED";
  openedAt?: string;
  closesAt: string;
  closedAt?: string | null;
  exitPrice?: number | null;
  settledReturnBps?: number | null;
};

function validateOperationInput(input: AdminCopyOperationInput): void {
  if (!input.symbol.trim() || input.symbol.trim().length > 20) {
    throw new CopyTradingError("Invalid symbol", "INVALID_AMOUNT");
  }
  if (input.direction !== "LONG" && input.direction !== "SHORT") {
    throw new CopyTradingError("Invalid direction", "INVALID_AMOUNT");
  }
  if (!Number.isInteger(input.leverage) || input.leverage < 1 || input.leverage > 125) {
    throw new CopyTradingError("Invalid leverage", "INVALID_AMOUNT");
  }
  if (!Number.isFinite(input.entryPrice) || input.entryPrice <= 0) {
    throw new CopyTradingError("Invalid entry price", "INVALID_AMOUNT");
  }
  if (
    !Number.isInteger(input.targetReturnBps) ||
    input.targetReturnBps < -10_000 ||
    input.targetReturnBps > 10_000
  ) {
    throw new CopyTradingError("Invalid target return", "INVALID_AMOUNT");
  }
  if (input.status !== "OPEN" && input.status !== "CLOSED") {
    throw new CopyTradingError("Invalid status", "INVALID_AMOUNT");
  }
  if (Number.isNaN(new Date(input.closesAt).getTime())) {
    throw new CopyTradingError("Invalid close time", "INVALID_AMOUNT");
  }
  if (
    input.settledReturnBps != null &&
    (!Number.isInteger(input.settledReturnBps) ||
      input.settledReturnBps < -10_000 ||
      input.settledReturnBps > 10_000)
  ) {
    throw new CopyTradingError("Invalid settled return", "INVALID_AMOUNT");
  }
  if (
    input.exitPrice != null &&
    (!Number.isFinite(input.exitPrice) || input.exitPrice <= 0)
  ) {
    throw new CopyTradingError("Invalid exit price", "INVALID_AMOUNT");
  }
}

export async function createAdminCopyOperation(
  traderId: string,
  input: AdminCopyOperationInput,
  adminUserId: string,
): Promise<AdminCopyTraderOperationDto> {
  validateOperationInput(input);
  const trader = await prisma.copyTrader.findUnique({ where: { id: traderId } });
  if (!trader) throw new CopyTradingError("Trader not found", "NOT_FOUND");

  if (input.status === "OPEN") {
    const open = await prisma.copyTraderOperation.findFirst({
      where: { traderId, status: "OPEN" },
    });
    if (open) {
      throw new CopyTradingError(
        "Close the open operation first",
        "INVALID_AMOUNT",
      );
    }
  }

  const openedAt = input.openedAt ? new Date(input.openedAt) : new Date();
  const closesAt = new Date(input.closesAt);
  const closedAt =
    input.status === "CLOSED"
      ? input.closedAt
        ? new Date(input.closedAt)
        : new Date()
      : null;

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.copyTraderOperation.create({
      data: {
        traderId,
        symbol: input.symbol.trim().toUpperCase(),
        direction: input.direction,
        leverage: input.leverage,
        entryPrice: input.entryPrice,
        targetReturnBps: input.targetReturnBps,
        status: input.status,
        openedAt,
        closesAt,
        closedAt,
        exitPrice: input.exitPrice ?? null,
        settledReturnBps:
          input.status === "CLOSED"
            ? (input.settledReturnBps ?? input.targetReturnBps)
            : null,
        idempotencyKey: `admin-op:${traderId}:${randomUUID()}`,
        openKey: input.status === "OPEN" ? simulatedOpenKey(traderId) : null,
      },
    });
    return created;
  });

  return serializeCopyOperation(row, undefined, { forAdmin: true });
}

export async function updateAdminCopyOperation(
  operationId: string,
  input: AdminCopyOperationInput,
  adminUserId: string,
): Promise<AdminCopyTraderOperationDto> {
  validateOperationInput(input);
  const existing = await prisma.copyTraderOperation.findUnique({
    where: { id: operationId },
  });
  if (!existing) throw new CopyTradingError("Operation not found", "NOT_FOUND");

  if (input.status === "OPEN") {
    const otherOpen = await prisma.copyTraderOperation.findFirst({
      where: {
        traderId: existing.traderId,
        status: "OPEN",
        id: { not: operationId },
      },
    });
    if (otherOpen) {
      throw new CopyTradingError(
        "Close the open operation first",
        "INVALID_AMOUNT",
      );
    }
  }

  const openedAt = input.openedAt ? new Date(input.openedAt) : existing.openedAt;
  const closesAt = new Date(input.closesAt);
  const closedAt =
    input.status === "CLOSED"
      ? input.closedAt
        ? new Date(input.closedAt)
        : (existing.closedAt ?? new Date())
      : null;

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.copyTraderOperation.update({
      where: { id: operationId },
      data: {
        symbol: input.symbol.trim().toUpperCase(),
        direction: input.direction,
        leverage: input.leverage,
        entryPrice: input.entryPrice,
        targetReturnBps: input.targetReturnBps,
        status: input.status,
        openedAt,
        closesAt,
        closedAt,
        exitPrice: input.status === "CLOSED" ? (input.exitPrice ?? null) : null,
        settledReturnBps:
          input.status === "CLOSED"
            ? (input.settledReturnBps ?? input.targetReturnBps)
            : null,
        openKey:
          input.status === "OPEN"
            ? simulatedOpenKey(existing.traderId)
            : null,
      },
    });
    return updated;
  });

  return serializeCopyOperation(row, undefined, { forAdmin: true });
}

export async function deleteAdminCopyOperation(
  operationId: string,
  _adminUserId: string,
): Promise<void> {
  const existing = await prisma.copyTraderOperation.findUnique({
    where: { id: operationId },
  });
  if (!existing) throw new CopyTradingError("Operation not found", "NOT_FOUND");

  await prisma.copyTraderOperation.delete({ where: { id: operationId } });
}

function operationMark(
  operation: Prisma.CopyTraderOperationGetPayload<object>,
  now = new Date(),
): { markPrice: number; floatingReturnBps: number } {
  if (operation.status === "CLOSED") {
    return {
      markPrice: Number(operation.exitPrice ?? operation.entryPrice),
      floatingReturnBps:
        operation.settledReturnBps ?? operation.targetReturnBps,
    };
  }

  const floatingBps = floatingReturnBps({
    operationId: operation.id,
    targetReturnBps: operation.targetReturnBps,
    openedAt: operation.openedAt.getTime(),
    closesAt: operation.closesAt.getTime(),
    now: now.getTime(),
  });
  const directionSign = operation.direction === "LONG" ? 1 : -1;
  const priceMove =
    (floatingBps / operation.leverage / 10_000) * directionSign;
  return {
    markPrice: Number(operation.entryPrice) * (1 + priceMove),
    floatingReturnBps: floatingBps,
  };
}

function serializeCopyOperation(
  operation: Prisma.CopyTraderOperationGetPayload<object>,
  now: Date | undefined,
  opts: { forAdmin: true },
): AdminCopyTraderOperationDto;
function serializeCopyOperation(
  operation: Prisma.CopyTraderOperationGetPayload<object>,
  now?: Date,
  opts?: { forAdmin?: false },
): CopyTraderOperationDto;
function serializeCopyOperation(
  operation: Prisma.CopyTraderOperationGetPayload<object>,
  now = new Date(),
  opts?: { forAdmin?: boolean },
): CopyTraderOperationDto | AdminCopyTraderOperationDto {
  const mark = operationMark(operation, now);
  const dto: CopyTraderOperationDto = {
    id: operation.id,
    traderId: operation.traderId,
    symbol: operation.symbol,
    direction: operation.direction as "LONG" | "SHORT",
    leverage: operation.leverage,
    entryPrice: Number(operation.entryPrice),
    markPrice: mark.markPrice,
    exitPrice: operation.exitPrice == null ? null : Number(operation.exitPrice),
    floatingReturnBps: mark.floatingReturnBps,
    settledReturnBps: operation.settledReturnBps,
    status: operation.status as "OPEN" | "CLOSED",
    openedAt: operation.openedAt.toISOString(),
    closedAt: operation.closedAt?.toISOString() ?? null,
    simulated: operation.synthetic === true,
  };
  if (!opts?.forAdmin) return dto;
  return {
    ...dto,
    targetReturnBps: operation.targetReturnBps,
    closesAt: operation.closesAt.toISOString(),
    synthetic: operation.synthetic === true,
  };
}

export async function userHasActiveCopyInvestment(
  userId: string,
  traderId: string,
): Promise<boolean> {
  const count = await prisma.copyInvestment.count({
    where: { userId, traderId, status: "ACTIVE" },
  });
  return count > 0;
}

export async function getCopyTraderOperations(
  traderId: string,
  _viewerUserId?: string | null,
): Promise<{
  locked: boolean;
  current: CopyTraderOperationDto | null;
  history: CopyTraderOperationDto[];
}> {
  await tickCopyTradingEngine();
  const rows = await prisma.copyTraderOperation.findMany({
    where: { traderId },
    orderBy: [{ status: "desc" }, { openedAt: "desc" }],
    take: 80,
  });
  const now = new Date();
  const current = rows.find((operation) => operation.status === "OPEN") ?? null;
  return {
    locked: false,
    current: current ? serializeCopyOperation(current, now) : null,
    history: rows
      .filter((operation) => operation.status === "CLOSED")
      .slice(0, 60)
      .map((operation) => serializeCopyOperation(operation, now)),
  };
}

function periodStartMs(period: CopyTraderStatsPeriod, now = Date.now()): number | null {
  if (period === "ALL") return null;
  if (period === "TODAY") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (period === "WEEK") return now - 7 * 24 * 60 * 60 * 1000;
  return now - 30 * 24 * 60 * 60 * 1000;
}

export async function getCopyTraderStats(
  traderId: string,
  period: CopyTraderStatsPeriod = "ALL",
  opts?: { requireVisible?: boolean },
): Promise<CopyTraderStatsDto | null> {
  const trader = await prisma.copyTrader.findFirst({
    where: {
      id: traderId,
      ...(opts?.requireVisible === false ? {} : { isVisible: true }),
    },
    select: { id: true },
  });
  if (!trader) return null;

  const startMs = periodStartMs(period);
  const closed = await prisma.copyTraderOperation.findMany({
    where: {
      traderId,
      status: "CLOSED",
      ...(startMs != null
        ? { closedAt: { gte: new Date(startMs) } }
        : {}),
    },
    orderBy: { closedAt: "asc" },
    take: 500,
  });

  const returns = closed.map((op) => op.settledReturnBps ?? op.targetReturnBps);
  const wins = returns.filter((bps) => bps > 0).length;
  const avgReturnBps =
    returns.length === 0
      ? null
      : Math.round(returns.reduce((a, b) => a + b, 0) / returns.length);
  const winRateBps =
    returns.length === 0 ? 0 : Math.round((wins / returns.length) * 10_000);

  const coinMap = new Map<string, number>();
  for (const op of closed) {
    coinMap.set(op.symbol, (coinMap.get(op.symbol) ?? 0) + 1);
  }
  const totalOps = closed.length || 1;
  const coinBreakdown = [...coinMap.entries()]
    .map(([symbol, ops]) => ({
      symbol,
      ops,
      shareBps: Math.round((ops / totalOps) * 10_000),
    }))
    .sort((a, b) => b.ops - a.ops)
    .slice(0, 8);

  const dayMap = new Map<string, { returnBps: number; ops: number }>();
  for (const op of closed) {
    const closedAt = op.closedAt ?? op.openedAt;
    const key = closedAt.toISOString().slice(0, 10);
    const prev = dayMap.get(key) ?? { returnBps: 0, ops: 0 };
    prev.returnBps += op.settledReturnBps ?? op.targetReturnBps;
    prev.ops += 1;
    dayMap.set(key, prev);
  }
  const dailyPnl = [...dayMap.entries()]
    .map(([date, v]) => ({ date, returnBps: v.returnBps, ops: v.ops }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    period,
    avgReturnBps,
    opsCount: closed.length,
    winRateBps,
    coinBreakdown,
    dailyPnl,
  };
}

function maskUsername(username: string | null, wallet: string): string {
  const raw = (username?.trim() || wallet.replace(/^0x/i, "")).toUpperCase();
  if (raw.length <= 2) return `${raw}****`;
  if (raw.length <= 4) return `${raw.slice(0, 1)}****${raw.slice(-1)}`;
  return `${raw.slice(0, 2)}******${raw.slice(-1)}`;
}

function maskWallet(wallet: string): string {
  if (wallet.length < 10) return wallet;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export type CopierSortMode =
  | "pnl_desc"
  | "pnl_asc"
  | "roi_desc"
  | "dur_desc";

export async function listCopyTraderCopiers(
  traderId: string,
  opts?: { sort?: CopierSortMode; viewerUserId?: string | null },
): Promise<CopyTraderCopiersDto | null> {
  const trader = await prisma.copyTrader.findFirst({
    where: { id: traderId, isVisible: true },
    select: { id: true, maxInvestors: true, showcaseCopiers: true },
  });
  if (!trader) return null;

  const rows = await prisma.copyInvestment.findMany({
    where: { traderId, status: "ACTIVE" },
    include: {
      user: { select: { id: true, username: true, walletAddress: true } },
    },
    orderBy: { startedAt: "asc" },
    take: 200,
  });

  // One row per user (sum if multiple active legs — normally one).
  const byUser = new Map<
    string,
    {
      userId: string;
      username: string | null;
      wallet: string;
      principal: bigint;
      currentValue: bigint;
      startedAt: Date;
    }
  >();
  for (const row of rows) {
    const prev = byUser.get(row.userId);
    if (!prev) {
      byUser.set(row.userId, {
        userId: row.userId,
        username: row.user.username,
        wallet: row.user.walletAddress,
        principal: row.principal,
        currentValue: row.currentValue,
        startedAt: row.startedAt,
      });
      continue;
    }
    prev.principal += row.principal;
    prev.currentValue += row.currentValue;
    if (row.startedAt < prev.startedAt) prev.startedAt = row.startedAt;
  }

  const now = Date.now();
  let copiers: CopyTraderCopierDto[] = [...byUser.values()].map((u) => {
    const pnl = fromMicro(u.currentValue - u.principal);
    const margin = fromMicro(u.currentValue);
    return {
      displayName: maskUsername(u.username, u.wallet),
      walletHint: maskWallet(u.wallet),
      isYou: opts?.viewerUserId === u.userId,
      margin,
      pnl,
      roiBps: roiBpsOf(u.principal, u.currentValue),
      durationDays: Math.max(
        1,
        Math.floor((now - u.startedAt.getTime()) / (24 * 60 * 60 * 1000)),
      ),
      startedAt: u.startedAt.toISOString(),
    };
  });

  const showcaseNeeded = Math.max(0, trader.showcaseCopiers - copiers.length);
  copiers.push(
    ...generateShowcaseCopiers(trader.id, showcaseNeeded, new Date(now)),
  );

  const sort = opts?.sort ?? "pnl_desc";
  copiers.sort((a, b) => {
    if (sort === "pnl_asc") return a.pnl - b.pnl;
    if (sort === "roi_desc") return b.roiBps - a.roiBps;
    if (sort === "dur_desc") return b.durationDays - a.durationDays;
    return b.pnl - a.pnl;
  });

  return {
    total: copiers.length,
    maxInvestors: trader.maxInvestors,
    copiers: copiers.slice(0, 50),
  };
}

async function openSimulatedOperation(
  trader: Prisma.CopyTraderGetPayload<object>,
  plan: DayPlan,
  now: Date,
  attempt = 0,
): Promise<Prisma.CopyTraderOperationGetPayload<object>> {
  if (attempt > 5) {
    throw new CopyTradingError("Could not open operation", "INVALID_AMOUNT");
  }
  const settings = scheduleSettingsFromTrader(trader);
  const seq = plan.opsToday;
  const operationKey = operationOpenIdempotencyKey(trader.id, plan.dayKey, seq);
  const digest = scheduleDigest(operationKey);
  const configRow = await prisma.copyTradingConfig.findUnique({
    where: { id: 1 },
    select: { activeSymbols: true },
  });
  const market = pickMarket(
    digest,
    marketsFromSymbols(configRow?.activeSymbols),
  );
  const direction = digest[1] % 2 === 0 ? "LONG" : "SHORT";
  const profile = riskProfileOf(trader.riskLevel);
  const leverage = deterministicRange(
    digest,
    4,
    profile.leverageMin,
    profile.leverageMax,
  );
  let progressBps = 0;
  let elapsedDays = 0.15;
  if (trader.targetMode) {
    const cycleStart = resolveTargetCycleStart(
      trader.targetCycleStartedAt,
      trader.targetCycleDays ?? DEFAULT_TARGET_CYCLE_DAYS,
      now,
    );
    if (
      trader.targetCycleStartedAt == null ||
      trader.targetCycleStartedAt.getTime() !== cycleStart.getTime()
    ) {
      await prisma.copyTrader.update({
        where: { id: trader.id },
        data: { targetCycleStartedAt: cycleStart },
      });
      trader.targetCycleStartedAt = cycleStart;
    }
    const closed = await prisma.copyTraderOperation.aggregate({
      where: {
        traderId: trader.id,
        status: "CLOSED",
        synthetic: false,
        closedAt: { gte: cycleStart },
      },
      _sum: { settledReturnBps: true },
    });
    progressBps = closed._sum.settledReturnBps ?? 0;
    elapsedDays = targetElapsedDays(cycleStart, now);
  }
  const role = assignOperationRole({
    targetMode: trader.targetMode,
    monthlyTargetBps: trader.monthlyTargetBps,
    progressBps,
    elapsedDays,
    cycleDays: trader.targetCycleDays ?? DEFAULT_TARGET_CYCLE_DAYS,
    digest,
  });
  const targetReturnBps = pickTargetedReturnBps({
    targetMode: trader.targetMode,
    monthlyTargetBps: trader.monthlyTargetBps,
    progressBps,
    elapsedDays,
    cycleDays: trader.targetCycleDays ?? DEFAULT_TARGET_CYCLE_DAYS,
    minBps: trader.simulationMinBps,
    maxBps: trader.simulationMaxBps,
    digest,
    role,
    winProbBps: trader.winProbBps ?? DEFAULT_WIN_PROB_BPS,
    lossProbBps: trader.lossProbBps ?? DEFAULT_LOSS_PROB_BPS,
  });
  const entryNoiseBps = deterministicRange(digest, 12, -180, 180);
  const entryPrice = market.basePrice * (1 + entryNoiseBps / 10_000);
  const durationMs = operationDurationMs(
    trader.id,
    plan.dayKey,
    seq,
    settings.durationMinMinutes,
    settings.durationMaxMinutes,
  );
  const closesAt = new Date(now.getTime() + durationMs);

  try {
    const operation = await prisma.$transaction(async (tx) => {
      const created = await tx.copyTraderOperation.create({
        data: {
          traderId: trader.id,
          symbol: market.symbol,
          direction,
          leverage,
          entryPrice,
          targetReturnBps,
          status: "OPEN",
          openKey: simulatedOpenKey(trader.id),
          idempotencyKey: operationKey,
          openedAt: now,
          closesAt,
        },
      });
      const config = await tx.copyTradingConfig.findUnique({
        where: { id: 1 },
        select: { openFeeBps: true },
      });
      await chargePlatformOpenFee(
        tx,
        created,
        config?.openFeeBps ?? DEFAULT_OPEN_FEE_BPS,
      );
      return created;
    });
    await persistTraderPlan(trader.id, plan, now, {
      closesAt,
      clearNextOpen: true,
    });
    return operation;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const existingOpen = await prisma.copyTraderOperation.findFirst({
        where: { traderId: trader.id, status: "OPEN" },
      });
      if (existingOpen) return existingOpen;
      const used = await prisma.copyTraderOperation.findUnique({
        where: { idempotencyKey: operationKey },
      });
      if (used) {
        const closedToday = await countClosedOpsToday(trader.id, now);
        const recovered: DayPlan = {
          ...plan,
          opsToday: Math.max(plan.opsToday, closedToday, seq + 1),
        };
        return openSimulatedOperation(trader, recovered, now, attempt + 1);
      }
    }
    throw error;
  }
}

async function closeSimulatedOperation(input: {
  operation: Prisma.CopyTraderOperationGetPayload<object>;
  trader: Prisma.CopyTraderGetPayload<object>;
  adminUserId: string;
  now: Date;
}) {
  const { operation, trader, adminUserId, now } = input;
  const result = await applyTraderPerformanceUpdate({
    traderId: trader.id,
    period: "TODAY",
    returnBps: operation.targetReturnBps,
    adminUserId,
    idempotencyKey: operationSettlementKey(operation.id),
    source: "SIMULATION",
    eligibleAsOf: now,
  });
  const directionSign = operation.direction === "LONG" ? 1 : -1;
  const priceMove =
    (operation.targetReturnBps / operation.leverage / 10_000) * directionSign;
  const exitPrice = Number(operation.entryPrice) * (1 + priceMove);
  const updated = await prisma.copyTraderOperation.updateMany({
    where: { id: operation.id, status: "OPEN" },
    data: {
      status: "CLOSED",
      openKey: null,
      exitPrice,
      settledReturnBps: operation.targetReturnBps,
      performanceEventId: result.eventId,
      closedAt: now,
    },
  });
  await stampOperationSettlementFees(operation.id, result.eventId);
  return { ...result, closedNow: updated.count > 0 };
}

type SimulationAction = "OPENED" | "CLOSED" | "WAITING" | "RESTING";

function scheduleSettingsFromTrader(
  trader: Prisma.CopyTraderGetPayload<object>,
): ScheduleSettings {
  return {
    traderId: trader.id,
    minOpsPerDay: trader.simulationMinOpsPerDay ?? DEFAULT_MIN_OPS_PER_DAY,
    maxOpsPerDay: trader.simulationMaxOpsPerDay ?? DEFAULT_MAX_OPS_PER_DAY,
    durationMinMinutes:
      trader.simulationDurationMinMinutes ?? DEFAULT_DURATION_MIN_MINUTES,
    durationMaxMinutes:
      trader.simulationDurationMaxMinutes ?? DEFAULT_DURATION_MAX_MINUTES,
  };
}

async function countClosedOpsToday(traderId: string, now: Date): Promise<number> {
  return prisma.copyTraderOperation.count({
    where: {
      traderId,
      status: "CLOSED",
      synthetic: false,
      closedAt: { gte: utcDayStart(now), lt: utcNextDayStart(now) },
    },
  });
}

async function persistTraderPlan(
  traderId: string,
  plan: DayPlan,
  now: Date,
  extra?: {
    lastRunAt?: Date;
    closesAt?: Date | null;
    clearNextOpen?: boolean;
  },
) {
  const nextOpen = extra?.clearNextOpen ? null : plan.nextOperationAt;
  await prisma.copyTrader.update({
    where: { id: traderId },
    data: {
      simulationOpsDayKey: plan.dayKey,
      simulationOpsToday: plan.opsToday,
      simulationOpsTarget: plan.opsTarget,
      nextOperationAt: nextOpen,
      simulationLastRunAt: extra?.lastRunAt,
      simulationNextRunAt: nextWakeAt({
        closesAt: extra?.closesAt,
        nextOperationAt: nextOpen,
        now,
      }),
    },
  });
}

async function syncTraderDayPlan(
  trader: Prisma.CopyTraderGetPayload<object>,
  now: Date,
): Promise<{ trader: Prisma.CopyTraderGetPayload<object>; plan: DayPlan }> {
  const closedToday = await countClosedOpsToday(trader.id, now);
  const plan = ensureDayPlan(
    {
      dayKey: trader.simulationOpsDayKey ?? "",
      opsToday: Math.max(trader.simulationOpsToday, closedToday),
      opsTarget: trader.simulationOpsTarget,
      nextOperationAt: trader.nextOperationAt,
    },
    scheduleSettingsFromTrader(trader),
    now,
  );
  if (plan.dayKey === utcDayStart(now).toISOString().slice(0, 10)) {
    plan.opsToday = Math.max(plan.opsToday, closedToday);
  }
  await persistTraderPlan(trader.id, plan, now, {
    closesAt: undefined,
  });
  return {
    trader: {
      ...trader,
      simulationOpsDayKey: plan.dayKey,
      simulationOpsToday: plan.opsToday,
      simulationOpsTarget: plan.opsTarget,
      nextOperationAt: plan.nextOperationAt,
    },
    plan,
  };
}

async function processTraderLifecycle(input: {
  trader: Prisma.CopyTraderGetPayload<object>;
  now: Date;
  adminUserId: string;
  closeOperationId?: string;
}): Promise<{
  traderId: string;
  operationId: string;
  action: SimulationAction;
  returnBps: number;
  affected: number;
  alreadyApplied: boolean;
  totalDelta: number;
}> {
  const { now, adminUserId } = input;
  const { trader, plan } = await syncTraderDayPlan(input.trader, now);
  const settings = scheduleSettingsFromTrader(trader);
  const current = await prisma.copyTraderOperation.findFirst({
    where: { traderId: trader.id, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });

  const shouldClose =
    current != null &&
    (current.closesAt.getTime() <= now.getTime() ||
      (input.closeOperationId != null && current.id === input.closeOperationId));

  if (input.closeOperationId && (!current || current.id !== input.closeOperationId)) {
    throw new CopyTradingError("Operation is not open", "INVALID_AMOUNT");
  }

  if (current && shouldClose) {
    const settlement = await closeSimulatedOperation({
      operation: current,
      trader,
      adminUserId,
      now,
    });
    const closedToday = await countClosedOpsToday(trader.id, now);
    const nextPlan = afterCloseSchedule(
      { ...plan, opsToday: Math.max(0, closedToday - 1) },
      settings,
      now,
    );
    nextPlan.opsToday = closedToday;
    await persistTraderPlan(trader.id, nextPlan, now, { lastRunAt: now });
    return {
      traderId: trader.id,
      operationId: current.id,
      action: "CLOSED",
      returnBps: current.targetReturnBps,
      affected: settlement.affected,
      alreadyApplied: settlement.alreadyApplied,
      totalDelta: settlement.totalDelta,
    };
  }

  if (current) {
    await persistTraderPlan(trader.id, plan, now, { closesAt: current.closesAt });
    return {
      traderId: trader.id,
      operationId: current.id,
      action: "WAITING",
      returnBps: 0,
      affected: 0,
      alreadyApplied: false,
      totalDelta: 0,
    };
  }

  if (plan.opsToday >= plan.opsTarget) {
    const resting: DayPlan = {
      ...plan,
      nextOperationAt: utcNextDayStart(now),
    };
    await persistTraderPlan(trader.id, resting, now);
    return {
      traderId: trader.id,
      operationId: "",
      action: "RESTING",
      returnBps: 0,
      affected: 0,
      alreadyApplied: false,
      totalDelta: 0,
    };
  }

  if (plan.nextOperationAt && plan.nextOperationAt.getTime() > now.getTime()) {
    await persistTraderPlan(trader.id, plan, now);
    return {
      traderId: trader.id,
      operationId: "",
      action: "WAITING",
      returnBps: 0,
      affected: 0,
      alreadyApplied: false,
      totalDelta: 0,
    };
  }

  const opened = await openSimulatedOperation(trader, plan, now);
  return {
    traderId: trader.id,
    operationId: opened.id,
    action: "OPENED",
    returnBps: 0,
    affected: 0,
    alreadyApplied: false,
    totalDelta: 0,
  };
}

export async function closeAdminCopyOperationNow(
  operationId: string,
  adminUserId: string,
  now = new Date(),
): Promise<AdminCopyTraderOperationDto> {
  const operation = await prisma.copyTraderOperation.findUnique({
    where: { id: operationId },
  });
  if (!operation) throw new CopyTradingError("Operation not found", "NOT_FOUND");
  if (operation.status !== "OPEN") {
    return serializeCopyOperation(operation, now, { forAdmin: true });
  }

  const trader = await prisma.copyTrader.findUnique({
    where: { id: operation.traderId },
  });
  if (!trader) throw new CopyTradingError("Trader not found", "NOT_FOUND");

  await processTraderLifecycle({
    trader,
    now,
    adminUserId,
    closeOperationId: operationId,
  });

  const closed = await prisma.copyTraderOperation.findUniqueOrThrow({
    where: { id: operationId },
  });
  return serializeCopyOperation(closed, now, { forAdmin: true });
}

const ENGINE_TICK_GAP_MS = 5_000;
let lastEngineTickMs = 0;
let engineTickInFlight: Promise<void> | null = null;

/** Open/close due live ops. Safe to call from admin and public reads. */
export async function tickCopyTradingEngine(now = new Date()): Promise<void> {
  if (engineTickInFlight) {
    await engineTickInFlight;
    return;
  }
  if (now.getTime() - lastEngineTickMs < ENGINE_TICK_GAP_MS) return;
  lastEngineTickMs = now.getTime();
  engineTickInFlight = runCopyTradingSimulation({ now })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      engineTickInFlight = null;
    });
  await engineTickInFlight;
}

export async function runCopyTradingSimulation(input?: {
  traderId?: string;
  force?: boolean;
  adminUserId?: string;
  now?: Date;
}): Promise<{
  processed: number;
  skipped: number;
  affectedInvestments: number;
  totalDelta: number;
  results: Array<{
    traderId: string;
    operationId: string;
    action: SimulationAction;
    returnBps: number;
    affected: number;
    alreadyApplied: boolean;
  }>;
}> {
  const now = input?.now ?? new Date();
  const adminUserId = input?.adminUserId ?? (await getDefaultAdminActorId());
  if (!adminUserId) {
    throw new CopyTradingError(
      "No active admin user is available for audit logging",
      "FORBIDDEN",
    );
  }

  await executeDueScheduledManualResults(now);

  const rows = await prisma.copyTrader.findMany({
    where: {
      simulationEnabled: true,
      isActive: true,
      ...(input?.traderId ? { id: input.traderId } : {}),
      ...(!input?.force
        ? {
            OR: [
              { simulationNextRunAt: null },
              { simulationNextRunAt: { lte: now } },
              { nextOperationAt: { lte: now } },
              {
                operations: {
                  some: { status: "OPEN", closesAt: { lte: now } },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { sortOrder: "asc" },
  });

  const results: Array<{
    traderId: string;
    operationId: string;
    action: SimulationAction;
    returnBps: number;
    affected: number;
    alreadyApplied: boolean;
  }> = [];
  let totalDelta = 0;
  let affectedInvestments = 0;

  for (const trader of rows) {
    const result = await processTraderLifecycle({
      trader,
      now,
      adminUserId,
    });
    results.push({
      traderId: result.traderId,
      operationId: result.operationId,
      action: result.action,
      returnBps: result.returnBps,
      affected: result.affected,
      alreadyApplied: result.alreadyApplied,
    });
    totalDelta += result.totalDelta;
    affectedInvestments += result.affected;
  }

  return {
    processed: rows.length,
    skipped: results.filter((result) => result.alreadyApplied).length,
    affectedInvestments,
    totalDelta,
    results,
  };
}

export async function decideCopyWithdrawal(input: {
  withdrawalId: string;
  decision: "APPROVE" | "REJECT";
  adminUserId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.copyWithdrawal.findFirst({
      where: { id: input.withdrawalId, status: "REQUESTED" },
      include: { investment: true },
    });
    if (!withdrawal) {
      throw new CopyTradingError("Pending withdrawal not found", "NOT_FOUND");
    }

    const now = new Date();
    if (input.decision === "REJECT") {
      await tx.copyWithdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: "REJECTED",
          processedAt: now,
          processedById: input.adminUserId,
        },
      });
    } else {
      const math = applyWithdrawalMath(
        withdrawal.investment.principal,
        withdrawal.investment.currentValue,
        withdrawal.amount,
      );
      if (math.withdrawn <= 0n) {
        throw new CopyTradingError(
          "Nothing remains to withdraw",
          "INVALID_AMOUNT",
        );
      }
      await tx.copyInvestment.update({
        where: { id: withdrawal.investmentId },
        data: {
          principal: math.principal,
          currentValue: math.currentValue,
          status: math.closed ? "CLOSED" : "ACTIVE",
          closedAt: math.closed ? now : null,
        },
      });
      await tx.copyInvestmentLedger.create({
        data: {
          investmentId: withdrawal.investmentId,
          kind: "WITHDRAWAL",
          amount: -math.withdrawn,
          balanceAfter: math.currentValue,
          note: "Admin-approved copy withdrawal",
        },
      });
      await tx.copyWithdrawal.update({
        where: { id: withdrawal.id },
        data: {
          amount: math.withdrawn,
          status: "COMPLETED",
          processedAt: now,
          processedById: input.adminUserId,
        },
      });
      await tx.user.update({
        where: { id: withdrawal.userId },
        data: { copyCashBalance: { increment: math.withdrawn } },
      });
      await tx.copyTrader.update({
        where: { id: withdrawal.investment.traderId },
        data: { aum: { decrement: math.withdrawn } },
      });
    }
  });
}

export async function registerDeviceToken(input: {
  userId: string;
  token: string;
  platform: string;
}): Promise<void> {
  if (!input.token.trim()) return;

  await prisma.deviceToken.upsert({
    where: { token: input.token },
    update: {
      userId: input.userId,
      platform: input.platform,
      updatedAt: new Date(),
    },
    create: {
      userId: input.userId,
      token: input.token,
      platform: input.platform,
    },
  });
}
