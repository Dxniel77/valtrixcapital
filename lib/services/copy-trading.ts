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
import { applyPerformance } from "@/lib/copy-trading/sync-engine";
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
  simulationEnabled: boolean;
  simulationMinBps: number;
  simulationMaxBps: number;
  simulationIntervalHours: number;
  simulationLastRunAt: string | null;
  simulationNextRunAt: string | null;
  activeInvestments: number;
};

export type CopyTradingConfigDto = {
  globalMinInvestment: number;
  withdrawalMode: CopyWithdrawalMode;
  notifyOnPerformance: boolean;
  investFeeBps: number;
  withdrawFeeBps: number;
  settlementCutoffHour: number;
};

export type CopyInvestmentDto = {
  id: string;
  traderId: string;
  traderName: string;
  traderRisk: CopyRiskLevel;
  principal: number;
  currentValue: number;
  realizedPnl: number;
  roiBps: number;
  status: CopyInvestmentStatus;
  startedAt: number;
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
  targetReturnBps: number;
  floatingReturnBps: number;
  settledReturnBps: number | null;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closesAt: string;
  closedAt: string | null;
  simulated: true;
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

function utcDateOnly(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new CopyTradingError("Invalid date", "INVALID_AMOUNT");
  }
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Last settlement cutoff at `hour` UTC on or before `now`. */
export function lastSettlementCutoff(
  hour: number,
  now = new Date(),
): Date {
  const h = Math.min(23, Math.max(0, Math.trunc(hour)));
  const cutoff = new Date(now);
  cutoff.setUTCHours(h, 0, 0, 0);
  if (cutoff.getTime() > now.getTime()) {
    cutoff.setUTCDate(cutoff.getUTCDate() - 1);
  }
  return cutoff;
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
    investorsCount: t.investorsCount,
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
    performanceFeeBps: t.performanceFeeBps ?? 1000,
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
): AdminCopyTraderDto {
  return {
    ...serializeTrader(t),
    simulationEnabled: t.simulationEnabled,
    simulationMinBps: t.simulationMinBps,
    simulationMaxBps: t.simulationMaxBps,
    simulationIntervalHours: t.simulationIntervalHours,
    simulationLastRunAt: t.simulationLastRunAt?.toISOString() ?? null,
    simulationNextRunAt: t.simulationNextRunAt?.toISOString() ?? null,
    activeInvestments: t._count.investments,
  };
}

function serializeInvestment(inv: InvestmentRow): CopyInvestmentDto {
  return {
    id: inv.id,
    traderId: inv.traderId,
    traderName: inv.trader.name,
    traderRisk: inv.trader.riskLevel,
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
    create: { id: 1 },
  });
  return serializeCopyConfig(row);
}

function serializeCopyConfig(row: {
  globalMinInvestment: bigint;
  withdrawalMode: CopyWithdrawalMode;
  notifyOnPerformance: boolean;
  investFeeBps?: number;
  withdrawFeeBps?: number;
  settlementCutoffHour?: number;
}): CopyTradingConfigDto {
  return {
    globalMinInvestment: fromMicro(row.globalMinInvestment),
    withdrawalMode: row.withdrawalMode,
    notifyOnPerformance: row.notifyOnPerformance,
    investFeeBps: row.investFeeBps ?? 0,
    withdrawFeeBps: row.withdrawFeeBps ?? 0,
    settlementCutoffHour: row.settlementCutoffHour ?? 22,
  };
}

export async function updateCopyTradingConfig(input: {
  investFeeBps?: number;
  withdrawFeeBps?: number;
  settlementCutoffHour?: number;
  withdrawalMode?: CopyWithdrawalMode;
  globalMinInvestment?: number;
}): Promise<CopyTradingConfigDto> {
  await ensureCopyTradingConfig();
  const data: {
    investFeeBps?: number;
    withdrawFeeBps?: number;
    settlementCutoffHour?: number;
    withdrawalMode?: CopyWithdrawalMode;
    globalMinInvestment?: bigint;
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
  if (input.settlementCutoffHour !== undefined) {
    if (
      !Number.isInteger(input.settlementCutoffHour) ||
      input.settlementCutoffHour < 0 ||
      input.settlementCutoffHour > 23
    ) {
      throw new CopyTradingError("Invalid cutoff hour", "INVALID_AMOUNT");
    }
    data.settlementCutoffHour = input.settlementCutoffHour;
  }
  if (input.withdrawalMode) data.withdrawalMode = input.withdrawalMode;
  if (input.globalMinInvestment !== undefined) {
    data.globalMinInvestment = toMicro(input.globalMinInvestment);
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
  const row = await prisma.copyTrader.findFirst({
    where: { id, isVisible: true, isActive: true },
    include: {
      performances: { orderBy: { period: "asc" } },
      chartPoints: { orderBy: { date: "asc" } },
    },
  });
  if (!row) return null;

  const base = serializeTrader(row, { includePerformances: true });
  return {
    ...base,
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
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder: number;
  simulationEnabled: boolean;
  simulationMinBps: number;
  simulationMaxBps: number;
  simulationIntervalHours: number;
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
  if (
    !Number.isInteger(input.simulationIntervalHours) ||
    input.simulationIntervalHours < 1 ||
    input.simulationIntervalHours > 720
  ) {
    throw new CopyTradingError(
      "Simulation interval must be between 1 and 720 hours",
      "INVALID_AMOUNT",
    );
  }
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
  return rows.map(serializeAdminTrader);
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
        isActive: input.isActive,
        isVisible: input.isVisible,
        isFeatured: input.isFeatured,
        sortOrder: Math.trunc(input.sortOrder),
        simulationEnabled: input.simulationEnabled,
        simulationMinBps: input.simulationMinBps,
        simulationMaxBps: input.simulationMaxBps,
        simulationIntervalHours: input.simulationIntervalHours,
        simulationNextRunAt: input.simulationEnabled ? now : null,
      },
    });
    await tx.adminAction.create({
      data: {
        adminId: adminUserId,
        action: "UPDATE_CONFIG",
        payload: {
          kind: "COPY_TRADER_CREATED",
          traderId: created.id,
          name: created.name,
        },
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
        isActive: input.isActive,
        isVisible: input.isVisible,
        isFeatured: input.isFeatured,
        sortOrder: Math.trunc(input.sortOrder),
        simulationEnabled: input.simulationEnabled,
        simulationMinBps: input.simulationMinBps,
        simulationMaxBps: input.simulationMaxBps,
        simulationIntervalHours: input.simulationIntervalHours,
        simulationNextRunAt:
          input.simulationEnabled && !existing.simulationEnabled
            ? new Date()
            : undefined,
      },
    });
    await tx.adminAction.create({
      data: {
        adminId: adminUserId,
        action: "UPDATE_CONFIG",
        payload: {
          kind: "COPY_TRADER_UPDATED",
          traderId,
          name: input.name.trim(),
        },
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
            data: { earningsBalance: { increment: inv.currentValue } },
          });
          await tx.copyInvestmentLedger.create({
            data: {
              investmentId: inv.id,
              kind: "WITHDRAWAL",
              amount: -inv.currentValue,
              balanceAfter: 0n,
              note: "Admin deleted trader — refunded to earnings",
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

      await tx.adminAction.create({
        data: {
          adminId: adminUserId,
          action: "UPDATE_CONFIG",
          payload: {
            kind: "COPY_TRADERS_DELETED",
            traderIds: uniqueIds,
            deleted,
            refunded,
            refundedAmount: refundedAmount.toString(),
          },
        },
      });

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
  if (user.earningsBalance < amountMicro) {
    throw new CopyTradingError("Insufficient balance", "INSUFFICIENT_BALANCE");
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
      where: { id: input.userId, earningsBalance: { gte: amountMicro } },
      data: { earningsBalance: { decrement: amountMicro } },
    });
    if (updatedUser.count === 0) {
      throw new CopyTradingError(
        "Insufficient balance",
        "INSUFFICIENT_BALANCE",
      );
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
        investorsCount: prior === 0 ? { increment: 1 } : undefined,
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
        data: { earningsBalance: { increment: credited } },
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

        const cutoff = lastSettlementCutoff(
          (await tx.copyTradingConfig.findUnique({ where: { id: 1 } }))
            ?.settlementCutoffHour ?? 22,
        );
        const active = await tx.copyInvestment.findMany({
          where: {
            traderId: input.traderId,
            status: "ACTIVE",
            currentValue: { gt: 0 },
            startedAt: { lte: cutoff },
          },
        });

    const syncInput = active.map((i) => ({
      id: i.id,
      principal: i.principal,
      currentValue: i.currentValue,
      realizedPnl: i.realizedPnl,
    }));

    const result = applyPerformance(syncInput, input.returnBps);

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

        if (result.ledger.length > 0) {
          await tx.copyInvestmentLedger.createMany({
            data: result.ledger.map((entry) => ({
          investmentId: entry.investmentId,
          kind: "PNL" satisfies CopyLedgerKind,
          amount: entry.amount,
          balanceAfter: entry.balanceAfter,
              performanceId: event.id,
            })),
          });
        }

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        await tx.copyTraderChartPoint.upsert({
          where: { traderId_date: { traderId: input.traderId, date: today } },
          update: { valueBps: { increment: input.returnBps } },
          create: {
            traderId: input.traderId,
            date: today,
            valueBps: trader.cumulativeRoiBps + input.returnBps,
          },
        });
        await tx.copyTrader.update({
          where: { id: input.traderId },
          data: {
            roiBps: { increment: input.returnBps },
            cumulativeRoiBps: { increment: input.returnBps },
            aum: { increment: result.totalDelta },
            winningTrades: input.returnBps > 0 ? { increment: 1 } : undefined,
            losingTrades: input.returnBps < 0 ? { increment: 1 } : undefined,
            profitDays: input.returnBps > 0 ? { increment: 1 } : undefined,
          },
        });

    await tx.adminAction.create({
      data: {
        adminId: input.adminUserId,
        action: "UPDATE_CONFIG",
        targetUserId: null,
        payload: {
          kind: "COPY_PERFORMANCE",
          traderId: input.traderId,
          period: input.period,
          returnBps: input.returnBps,
              source: input.source ?? "ADMIN",
              eventId: event.id,
              idempotencyKey,
          affected: active.length,
          totalDelta: result.totalDelta.toString(),
        },
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

  return {
    affected: performance.affected,
    totalDelta: fromMicro(performance.totalDelta),
    eventId: performance.event.id,
    alreadyApplied: false,
  };
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
      where: {
        kind: { in: ["INVEST", "WITHDRAWAL"] },
        note: { contains: "fee " },
      },
      select: { note: true },
    }),
  ]);

  const principal = activeAggregate._sum.principal ?? 0n;
  const currentValue = activeAggregate._sum.currentValue ?? 0n;
  const companyFees = feeRows.reduce(
    (sum, row) => sum + parseFeeUsdtFromNote(row.note),
    0n,
  );
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
      pendingWithdrawals: pendingRows.length,
    },
    traders,
    openOperations: openOperations.map((operation) =>
      serializeCopyOperation(operation),
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

export type AdminCopyTraderDeskDto = {
  trader: AdminCopyTraderDto;
  config: CopyTradingConfigDto;
  situation: {
    activeCopies: number;
    eligibleTonight: number;
    skippedAfterCutoff: number;
    principal: number;
    currentValue: number;
    pnl: number;
    companyFees: number;
    cutoffAt: string;
    cutoffHour: number;
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
    eligibleTonight: boolean;
  }>;
  chartPoints: Array<{ id: string; date: string; valueBps: number }>;
  operations: CopyTraderOperationDto[];
  events: CopyPerformanceEventDto[];
};

export type AdminPerformancePreviewDto = {
  returnBps: number;
  eligible: number;
  skippedAfterCutoff: number;
  userDelta: number;
  companyFee: number;
  usersAfterFee: number;
  feeApplied: false;
  cutoffAt: string;
};

export async function previewTraderPerformance(
  traderId: string,
  returnBps: number,
): Promise<AdminPerformancePreviewDto> {
  if (
    !Number.isInteger(returnBps) ||
    returnBps < -10_000 ||
    returnBps > 10_000
  ) {
    throw new CopyTradingError(
      "returnBps must be an integer",
      "INVALID_AMOUNT",
    );
  }

  const [trader, config] = await Promise.all([
    prisma.copyTrader.findUnique({ where: { id: traderId } }),
    ensureCopyTradingConfig(),
  ]);
  if (!trader) throw new CopyTradingError("Trader not found", "NOT_FOUND");

  const cutoff = lastSettlementCutoff(config.settlementCutoffHour);
  const active = await prisma.copyInvestment.findMany({
    where: { traderId, status: "ACTIVE", currentValue: { gt: 0 } },
  });
  const eligible = active.filter((row) => row.startedAt <= cutoff);
  const result = applyPerformance(
    eligible.map((row) => ({
      id: row.id,
      principal: row.principal,
      currentValue: row.currentValue,
      realizedPnl: row.realizedPnl,
    })),
    returnBps,
  );

  let profitMicro = 0n;
  for (const entry of result.ledger) {
    if (entry.amount > 0n) profitMicro += entry.amount;
  }
  const companyFee = feeMicro(profitMicro, trader.performanceFeeBps ?? 1000);

  return {
    returnBps,
    eligible: eligible.length,
    skippedAfterCutoff: active.length - eligible.length,
    userDelta: fromMicro(result.totalDelta),
    companyFee: fromMicro(companyFee),
    usersAfterFee: fromMicro(result.totalDelta - companyFee),
    feeApplied: false,
    cutoffAt: cutoff.toISOString(),
  };
}

export async function getAdminCopyTraderDesk(
  traderId: string,
): Promise<AdminCopyTraderDeskDto> {
  const trader = await prisma.copyTrader.findUnique({
    where: { id: traderId },
    include: {
      _count: { select: { investments: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!trader) throw new CopyTradingError("Trader not found", "NOT_FOUND");

  const config = await ensureCopyTradingConfig();
  const cutoff = lastSettlementCutoff(config.settlementCutoffHour);

  const [active, chartPoints, operations, events, feeRows] = await Promise.all([
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
    prisma.copyPerformanceEvent.findMany({
      where: { traderId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { trader: { select: { name: true } } },
    }),
    prisma.copyInvestmentLedger.findMany({
      where: {
        kind: { in: ["INVEST", "WITHDRAWAL"] },
        note: { contains: "fee " },
        investment: { traderId },
      },
      select: { note: true },
    }),
  ]);

  const principal = active.reduce((sum, row) => sum + row.principal, 0n);
  const currentValue = active.reduce((sum, row) => sum + row.currentValue, 0n);
  const eligibleTonight = active.filter((row) => row.startedAt <= cutoff).length;
  const companyFees = feeRows.reduce(
    (sum, row) => sum + parseFeeUsdtFromNote(row.note),
    0n,
  );
  const now = new Date();

  return {
    trader: serializeAdminTrader(trader),
    config,
    situation: {
      activeCopies: active.length,
      eligibleTonight,
      skippedAfterCutoff: active.length - eligibleTonight,
      principal: fromMicro(principal),
      currentValue: fromMicro(currentValue),
      pnl: fromMicro(currentValue - principal),
      companyFees: fromMicro(companyFees),
      cutoffAt: cutoff.toISOString(),
      cutoffHour: config.settlementCutoffHour,
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
      eligibleTonight: row.startedAt <= cutoff,
    })),
    chartPoints: chartPoints.map((point) => ({
      id: point.id,
      date: point.date.toISOString().slice(0, 10),
      valueBps: point.valueBps,
    })),
    operations: operations.map((operation) =>
      serializeCopyOperation(operation, now),
    ),
    events: events.map((event) => ({
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
    await tx.adminAction.create({
      data: {
        adminId: adminUserId,
        action: "UPDATE_CONFIG",
        payload: { kind: "COPY_TRADER_VITRINA", traderId },
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

export async function upsertAdminChartPoint(
  traderId: string,
  dateStr: string,
  valueBps: number,
  adminUserId: string,
): Promise<{ id: string; date: string; valueBps: number }> {
  if (!Number.isInteger(valueBps) || valueBps < -1_000_000 || valueBps > 1_000_000) {
    throw new CopyTradingError("Invalid curve value", "INVALID_AMOUNT");
  }
  const trader = await prisma.copyTrader.findUnique({ where: { id: traderId } });
  if (!trader) throw new CopyTradingError("Trader not found", "NOT_FOUND");
  const date = utcDateOnly(dateStr);

  const point = await prisma.$transaction(async (tx) => {
    const row = await tx.copyTraderChartPoint.upsert({
      where: { traderId_date: { traderId, date } },
      update: { valueBps },
      create: { traderId, date, valueBps },
    });
    await tx.adminAction.create({
      data: {
        adminId: adminUserId,
        action: "UPDATE_CONFIG",
        payload: {
          kind: "COPY_TRADER_CHART",
          traderId,
          date: dateStr,
          valueBps,
        },
      },
    });
    return row;
  });

  return {
    id: point.id,
    date: point.date.toISOString().slice(0, 10),
    valueBps: point.valueBps,
  };
}

export async function deleteAdminChartPoint(
  traderId: string,
  dateStr: string,
  adminUserId: string,
): Promise<void> {
  const date = utcDateOnly(dateStr);
  const existing = await prisma.copyTraderChartPoint.findUnique({
    where: { traderId_date: { traderId, date } },
  });
  if (!existing) throw new CopyTradingError("History day not found", "NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.copyTraderChartPoint.delete({
      where: { traderId_date: { traderId, date } },
    });
    await tx.adminAction.create({
      data: {
        adminId: adminUserId,
        action: "UPDATE_CONFIG",
        payload: { kind: "COPY_TRADER_CHART_DELETED", traderId, date: dateStr },
      },
    });
  });
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
): Promise<CopyTraderOperationDto> {
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
        openKey:
          input.status === "OPEN"
            ? `admin-open:${traderId}:${randomUUID()}`
            : null,
      },
    });
    await tx.adminAction.create({
      data: {
        adminId: adminUserId,
        action: "UPDATE_CONFIG",
        payload: {
          kind: "COPY_OPERATION_CREATED",
          traderId,
          operationId: created.id,
        },
      },
    });
    return created;
  });

  return serializeCopyOperation(row);
}

export async function updateAdminCopyOperation(
  operationId: string,
  input: AdminCopyOperationInput,
  adminUserId: string,
): Promise<CopyTraderOperationDto> {
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
            ? (existing.openKey ?? `admin-open:${existing.traderId}:${randomUUID()}`)
            : null,
      },
    });
    await tx.adminAction.create({
      data: {
        adminId: adminUserId,
        action: "UPDATE_CONFIG",
        payload: {
          kind: "COPY_OPERATION_UPDATED",
          traderId: existing.traderId,
          operationId,
        },
      },
    });
    return updated;
  });

  return serializeCopyOperation(row);
}

export async function deleteAdminCopyOperation(
  operationId: string,
  adminUserId: string,
): Promise<void> {
  const existing = await prisma.copyTraderOperation.findUnique({
    where: { id: operationId },
  });
  if (!existing) throw new CopyTradingError("Operation not found", "NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.copyTraderOperation.delete({ where: { id: operationId } });
    await tx.adminAction.create({
      data: {
        adminId: adminUserId,
        action: "UPDATE_CONFIG",
        payload: {
          kind: "COPY_OPERATION_DELETED",
          traderId: existing.traderId,
          operationId,
        },
      },
    });
  });
}

const SIMULATED_MARKETS = [
  { symbol: "BTCUSDT", basePrice: 114_250 },
  { symbol: "ETHUSDT", basePrice: 3_720 },
  { symbol: "BNBUSDT", basePrice: 762 },
  { symbol: "SOLUSDT", basePrice: 171 },
  { symbol: "XRPUSDT", basePrice: 3.04 },
  { symbol: "ADAUSDT", basePrice: 0.76 },
  { symbol: "DOGEUSDT", basePrice: 0.22 },
  { symbol: "AVAXUSDT", basePrice: 24.8 },
  { symbol: "LINKUSDT", basePrice: 18.4 },
  { symbol: "DOTUSDT", basePrice: 4.2 },
] as const;

function operationDigest(seed: string): Buffer {
  return createHash("sha256").update(seed).digest();
}

function deterministicRange(
  digest: Buffer,
  offset: number,
  min: number,
  max: number,
): number {
  if (min === max) return min;
  return min + (digest.readUInt32BE(offset) % (max - min + 1));
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

  const duration = Math.max(
    1,
    operation.closesAt.getTime() - operation.openedAt.getTime(),
  );
  const progress = Math.max(
    0,
    Math.min(1, (now.getTime() - operation.openedAt.getTime()) / duration),
  );
  const waveSeed = operationDigest(operation.id).readUInt16BE(0) / 65_535;
  const wave = Math.sin(progress * Math.PI) * (waveSeed - 0.5) * 36;
  const floatingReturnBps = Math.round(
    operation.targetReturnBps * progress + wave,
  );
  const directionSign = operation.direction === "LONG" ? 1 : -1;
  const priceMove =
    (floatingReturnBps / operation.leverage / 10_000) * directionSign;
  return {
    markPrice: Number(operation.entryPrice) * (1 + priceMove),
    floatingReturnBps,
  };
}

function serializeCopyOperation(
  operation: Prisma.CopyTraderOperationGetPayload<object>,
  now = new Date(),
): CopyTraderOperationDto {
  const mark = operationMark(operation, now);
  return {
    id: operation.id,
    traderId: operation.traderId,
    symbol: operation.symbol,
    direction: operation.direction as "LONG" | "SHORT",
    leverage: operation.leverage,
    entryPrice: Number(operation.entryPrice),
    markPrice: mark.markPrice,
    exitPrice: operation.exitPrice == null ? null : Number(operation.exitPrice),
    targetReturnBps: operation.targetReturnBps,
    floatingReturnBps: mark.floatingReturnBps,
    settledReturnBps: operation.settledReturnBps,
    status: operation.status as "OPEN" | "CLOSED",
    openedAt: operation.openedAt.toISOString(),
    closesAt: operation.closesAt.toISOString(),
    closedAt: operation.closedAt?.toISOString() ?? null,
    simulated: true,
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
  viewerUserId?: string | null,
): Promise<{
  locked: boolean;
  current: CopyTraderOperationDto | null;
  history: CopyTraderOperationDto[];
}> {
  const unlocked = viewerUserId
    ? await userHasActiveCopyInvestment(viewerUserId, traderId)
    : false;

  if (!unlocked) {
    return { locked: true, current: null, history: [] };
  }

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
): Promise<CopyTraderStatsDto | null> {
  const trader = await prisma.copyTrader.findFirst({
    where: { id: traderId, isVisible: true },
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
    select: { id: true, maxInvestors: true },
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
  now: Date,
  force: boolean,
): Promise<Prisma.CopyTraderOperationGetPayload<object>> {
  const intervalMs = trader.simulationIntervalHours * 60 * 60 * 1000;
  const bucket = Math.floor(now.getTime() / intervalMs);
  const operationKey = force
    ? `operation:${trader.id}:manual:${randomUUID()}`
    : `operation:${trader.id}:${bucket}`;
  const digest = operationDigest(operationKey);
  const market = SIMULATED_MARKETS[digest[0] % SIMULATED_MARKETS.length];
  const direction = digest[1] % 2 === 0 ? "LONG" : "SHORT";
  const leverageRange =
    trader.riskLevel === "LOW"
      ? ([1, 3] as const)
      : trader.riskLevel === "HIGH"
        ? ([5, 12] as const)
        : ([2, 6] as const);
  const leverage = deterministicRange(
    digest,
    4,
    leverageRange[0],
    leverageRange[1],
  );
  const targetReturnBps = deterministicRange(
    digest,
    8,
    trader.simulationMinBps,
    trader.simulationMaxBps,
  );
  const entryNoiseBps = deterministicRange(digest, 12, -180, 180);
  const entryPrice = market.basePrice * (1 + entryNoiseBps / 10_000);
  const closesAt = new Date(now.getTime() + intervalMs);

  try {
    const operation = await prisma.copyTraderOperation.create({
      data: {
        traderId: trader.id,
        symbol: market.symbol,
        direction,
        leverage,
        entryPrice,
        targetReturnBps,
        status: "OPEN",
        openKey: trader.id,
        idempotencyKey: operationKey,
        openedAt: now,
        closesAt,
      },
    });
    await prisma.copyTrader.update({
      where: { id: trader.id },
      data: { simulationNextRunAt: closesAt },
    });
    return operation;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const existing = await prisma.copyTraderOperation.findFirst({
        where: { traderId: trader.id, status: "OPEN" },
      });
      if (existing) return existing;
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
    idempotencyKey: `operation-settlement:${operation.id}`,
    source: "SIMULATION",
  });
  const directionSign = operation.direction === "LONG" ? 1 : -1;
  const priceMove =
    (operation.targetReturnBps / operation.leverage / 10_000) * directionSign;
  const exitPrice = Number(operation.entryPrice) * (1 + priceMove);
  await prisma.copyTraderOperation.updateMany({
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
  await prisma.copyTrader.update({
    where: { id: trader.id },
    data: { simulationLastRunAt: now },
  });
  return result;
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
    action: "OPENED" | "CLOSED_AND_OPENED" | "WAITING";
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
            ],
          }
        : {}),
    },
    orderBy: { sortOrder: "asc" },
  });

  const results: Array<{
    traderId: string;
    operationId: string;
    action: "OPENED" | "CLOSED_AND_OPENED" | "WAITING";
    returnBps: number;
    affected: number;
    alreadyApplied: boolean;
  }> = [];
  let totalDelta = 0;
  let affectedInvestments = 0;

  for (const trader of rows) {
    const current = await prisma.copyTraderOperation.findFirst({
      where: { traderId: trader.id, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });

    if (current && !input?.force && current.closesAt > now) {
      results.push({
        traderId: trader.id,
        operationId: current.id,
        action: "WAITING",
        returnBps: 0,
        affected: 0,
        alreadyApplied: false,
      });
      continue;
    }

    let settlement: Awaited<ReturnType<typeof closeSimulatedOperation>> | null =
      null;
    if (current) {
      settlement = await closeSimulatedOperation({
        operation: current,
        trader,
        adminUserId,
        now,
      });
    }
    const next = await openSimulatedOperation(
      trader,
      now,
      input?.force === true,
    );
    results.push({
      traderId: trader.id,
      operationId: next.id,
      action: current ? "CLOSED_AND_OPENED" : "OPENED",
      returnBps: settlement ? current!.targetReturnBps : 0,
      affected: settlement?.affected ?? 0,
      alreadyApplied: settlement?.alreadyApplied ?? false,
    });
    totalDelta += settlement?.totalDelta ?? 0;
    affectedInvestments += settlement?.affected ?? 0;
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
        data: { earningsBalance: { increment: math.withdrawn } },
      });
      await tx.copyTrader.update({
        where: { id: withdrawal.investment.traderId },
        data: { aum: { decrement: math.withdrawn } },
      });
    }

    await tx.adminAction.create({
      data: {
        adminId: input.adminUserId,
        targetUserId: withdrawal.userId,
        action: "UPDATE_CONFIG",
        payload: {
          kind:
            input.decision === "APPROVE"
              ? "COPY_WITHDRAWAL_APPROVED"
              : "COPY_WITHDRAWAL_REJECTED",
          withdrawalId: withdrawal.id,
          investmentId: withdrawal.investmentId,
          requestedAmount: withdrawal.amount.toString(),
        },
      },
    });
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
