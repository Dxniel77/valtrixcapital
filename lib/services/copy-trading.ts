import type {
  CopyInvestmentStatus,
  CopyLedgerKind,
  CopyPeriod,
  CopyRiskLevel,
  CopyWithdrawalMode,
  CopyWithdrawalStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { applyPerformance } from "@/lib/copy-trading/sync-engine";
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
      | "TRADER_UNAVAILABLE",
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
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder: number;
  performances?: CopyTraderPerformanceDto[];
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

export type CopyTradingConfigDto = {
  globalMinInvestment: number;
  withdrawalMode: CopyWithdrawalMode;
  notifyOnPerformance: boolean;
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

function roiBpsOf(principal: bigint, currentValue: bigint): number {
  if (principal <= 0n) return 0;
  return Number(((currentValue - principal) * 10_000n) / principal);
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
    isActive: t.isActive,
    isVisible: t.isVisible,
    isFeatured: t.isFeatured,
    sortOrder: t.sortOrder,
    performances:
      opts?.includePerformances && "performances" in t && Array.isArray(t.performances)
        ? t.performances.map((p) => ({ period: p.period, returnBps: p.returnBps }))
        : undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
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
  w: Prisma.CopyWithdrawalGetPayload<{ include: { investment: { include: { trader: true } } } }>,
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
  return {
    globalMinInvestment: fromMicro(row.globalMinInvestment),
    withdrawalMode: row.withdrawalMode,
    notifyOnPerformance: row.notifyOnPerformance,
  };
}

export async function listCopyTraders(input?: {
  page?: number;
  pageSize?: number;
}): Promise<{ traders: CopyTraderDto[]; page: number; pageSize: number; total: number }> {
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input?.pageSize ?? 50));
  const where = { isVisible: true, isActive: true };

  const [total, rows] = await Promise.all([
    prisma.copyTrader.count({ where }),
    prisma.copyTrader.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { roiBps: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    traders: rows.map((t) => serializeTrader(t)),
    page,
    pageSize,
    total,
  };
}

export async function getCopyTraderDetail(id: string): Promise<CopyTraderDetailDto | null> {
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
    performances: row.performances.map((p) => ({ period: p.period, returnBps: p.returnBps })),
    chartPoints: row.chartPoints.map((p) => ({
      date: p.date.toISOString().slice(0, 10),
      valueBps: p.valueBps,
    })),
  };
}

export async function listUserCopyInvestments(userId: string): Promise<CopyInvestmentDto[]> {
  const rows = await prisma.copyInvestment.findMany({
    where: { userId },
    include: { trader: true },
    orderBy: { startedAt: "desc" },
  });
  return rows.map(serializeInvestment);
}

export async function listUserCopyWithdrawals(userId: string): Promise<CopyWithdrawalDto[]> {
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
    prisma.copyTrader.findFirst({ where: { id: input.traderId, isVisible: true, isActive: true } }),
    prisma.user.findUnique({ where: { id: input.userId } }),
  ]);

  if (!trader) throw new CopyTradingError("Trader not found", "TRADER_UNAVAILABLE");
  if (!user || !user.isActive) throw new CopyTradingError("Account inactive", "INACTIVE");

  const globalMinMicro = toMicro(config.globalMinInvestment);
  const minMicro = trader.minInvestment > globalMinMicro ? trader.minInvestment : globalMinMicro;

  if (amountMicro < minMicro) {
    throw new CopyTradingError("Below minimum investment", "INVALID_AMOUNT");
  }
  if (user.earningsBalance < amountMicro) {
    throw new CopyTradingError("Insufficient balance", "INSUFFICIENT_BALANCE");
  }

  const investment = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.updateMany({
      where: { id: input.userId, earningsBalance: { gte: amountMicro } },
      data: { earningsBalance: { decrement: amountMicro } },
    });
    if (updatedUser.count === 0) {
      throw new CopyTradingError("Insufficient balance", "INSUFFICIENT_BALANCE");
    }

    const prior = await tx.copyInvestment.count({
      where: { userId: input.userId, traderId: input.traderId, status: "ACTIVE" },
    });

    const created = await tx.copyInvestment.create({
      data: {
        userId: input.userId,
        traderId: input.traderId,
        principal: amountMicro,
        currentValue: amountMicro,
        realizedPnl: 0n,
        status: "ACTIVE",
      },
      include: { trader: true },
    });

    await tx.copyInvestmentLedger.create({
      data: {
        investmentId: created.id,
        kind: "INVEST",
        amount: amountMicro,
        balanceAfter: amountMicro,
        note: "Initial copy investment",
      },
    });

    await tx.copyTrader.update({
      where: { id: input.traderId },
      data: {
        aum: { increment: amountMicro },
        totalInvested: { increment: amountMicro },
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
): { principal: bigint; currentValue: bigint; withdrawn: bigint; closed: boolean } {
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
    if (inv.currentValue <= 0n) throw new CopyTradingError("Nothing to withdraw", "INVALID_AMOUNT");

    const math = applyWithdrawalMath(inv.principal, inv.currentValue, amountMicro);
    if (math.withdrawn <= 0n) throw new CopyTradingError("Invalid amount", "INVALID_AMOUNT");

    const instant = config.withdrawalMode === "INSTANT";
    const now = new Date();

    const withdrawal = await tx.copyWithdrawal.create({
      data: {
        investmentId: inv.id,
        userId: input.userId,
        amount: math.withdrawn,
        status: instant ? "COMPLETED" : "REQUESTED",
        processedAt: instant ? now : null,
      },
      include: { investment: { include: { trader: true } } },
    });

    if (instant) {
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
          note: "Instant copy withdrawal",
        },
      });

      await tx.user.update({
        where: { id: input.userId },
        data: { earningsBalance: { increment: math.withdrawn } },
      });

      await tx.copyTrader.update({
        where: { id: inv.traderId },
        data: { aum: { decrement: math.withdrawn } },
      });

      return { withdrawal, investment: updatedInv };
    }

    return { withdrawal, investment: inv };
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
}): Promise<{ affected: number; totalDelta: number }> {
  if (!Number.isInteger(input.returnBps)) {
    throw new CopyTradingError("returnBps must be an integer", "INVALID_AMOUNT");
  }

  const performance = await prisma.$transaction(async (tx) => {
    const trader = await tx.copyTrader.findUnique({ where: { id: input.traderId } });
    if (!trader) throw new CopyTradingError("Trader not found", "NOT_FOUND");

    const perf = await tx.copyTraderPerformance.upsert({
      where: { traderId_period: { traderId: input.traderId, period: input.period } },
      update: { returnBps: input.returnBps },
      create: { traderId: input.traderId, period: input.period, returnBps: input.returnBps },
    });

    const active = await tx.copyInvestment.findMany({
      where: { traderId: input.traderId, status: "ACTIVE", currentValue: { gt: 0 } },
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

    for (const entry of result.ledger) {
      await tx.copyInvestmentLedger.create({
        data: {
          investmentId: entry.investmentId,
          kind: "PNL" satisfies CopyLedgerKind,
          amount: entry.amount,
          balanceAfter: entry.balanceAfter,
          performanceId: perf.id,
        },
      });
    }

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
          affected: active.length,
          totalDelta: result.totalDelta.toString(),
        },
      },
    });

    return { perf, affected: active.length, totalDelta: result.totalDelta };
  });

  return {
    affected: performance.affected,
    totalDelta: fromMicro(performance.totalDelta),
  };
}

export async function registerDeviceToken(input: {
  userId: string;
  token: string;
  platform: string;
}): Promise<void> {
  if (!input.token.trim()) return;

  await prisma.deviceToken.upsert({
    where: { token: input.token },
    update: { userId: input.userId, platform: input.platform, updatedAt: new Date() },
    create: { userId: input.userId, token: input.token, platform: input.platform },
  });
}
