import { prisma } from "@/lib/db";
import {
  absFeeMicro,
  copyIncomeBucketKey,
  copyIncomeBucketLabels,
  copyIncomeRange,
  parseCopyInOutFeeMicro,
  type CopyIncomePeriod,
} from "@/lib/copy-trading/income-period";
import {
  COPY_NETWORK_LEVELS,
  performanceFeeUnfilledRetention,
} from "@/lib/copy-trading/performance-fee-network";
import { ensureCopyTradingConfig } from "@/lib/services/copy-trading";
import { fromMicro } from "@/lib/utils";

export type CopyIncomeTotals = {
  platformFees: number;
  performanceFees: number;
  copyInOutFees: number;
  networkPaid: number;
  networkByLevel: number[];
  unfilledLevelRetained: number;
  companyPerfFeeShare: number;
  companyKept: number;
  totalIncome: number;
  grossPositive: number;
  grossNegative: number;
  netGross: number;
  deposits: number;
  opsClosed: number;
};

export type CopyIncomeSnapshot = {
  connectedCapital: number;
  copierPrincipal: number;
  copierPnl: number;
  activeCopies: number;
};

export type CopyIncomeBucketRow = CopyIncomeTotals & {
  bucket: string;
};

export type CopyIncomeTraderRow = CopyIncomeTotals & {
  traderId: string;
  traderName: string;
};

export type AdminCopyIncomeReportDto = {
  period: CopyIncomePeriod;
  from: string | null;
  to: string;
  generatedAt: string;
  networkRatesBps: number[];
  snapshot: CopyIncomeSnapshot;
  totals: CopyIncomeTotals;
  buckets: CopyIncomeBucketRow[];
  traders: CopyIncomeTraderRow[];
};

type MutableTotals = {
  platformFees: bigint;
  performanceFees: bigint;
  copyInOutFees: bigint;
  networkPaid: bigint;
  networkByLevel: bigint[];
  unfilledLevelRetained: bigint;
  companyPerfFeeShare: bigint;
  grossPositive: bigint;
  grossNegative: bigint;
  deposits: bigint;
  opsClosed: number;
};

function emptyLevels(): bigint[] {
  return Array.from({ length: COPY_NETWORK_LEVELS }, () => 0n);
}

function emptyTotals(): MutableTotals {
  return {
    platformFees: 0n,
    performanceFees: 0n,
    copyInOutFees: 0n,
    networkPaid: 0n,
    networkByLevel: emptyLevels(),
    unfilledLevelRetained: 0n,
    companyPerfFeeShare: 0n,
    grossPositive: 0n,
    grossNegative: 0n,
    deposits: 0n,
    opsClosed: 0,
  };
}

function serializeTotals(row: MutableTotals): CopyIncomeTotals {
  const companyKeptPerf =
    row.performanceFees > row.networkPaid
      ? row.performanceFees - row.networkPaid
      : 0n;
  return {
    platformFees: fromMicro(row.platformFees),
    performanceFees: fromMicro(row.performanceFees),
    copyInOutFees: fromMicro(row.copyInOutFees),
    networkPaid: fromMicro(row.networkPaid),
    networkByLevel: row.networkByLevel.map((value) => fromMicro(value)),
    unfilledLevelRetained: fromMicro(row.unfilledLevelRetained),
    companyPerfFeeShare: fromMicro(row.companyPerfFeeShare),
    companyKept: fromMicro(
      row.platformFees + row.copyInOutFees + companyKeptPerf,
    ),
    totalIncome: fromMicro(row.platformFees + row.performanceFees),
    grossPositive: fromMicro(row.grossPositive),
    grossNegative: fromMicro(row.grossNegative),
    netGross: fromMicro(row.grossPositive + row.grossNegative),
    deposits: fromMicro(row.deposits),
    opsClosed: row.opsClosed,
  };
}

function addInto(target: MutableTotals, delta: Partial<MutableTotals>) {
  target.platformFees += delta.platformFees ?? 0n;
  target.performanceFees += delta.performanceFees ?? 0n;
  target.copyInOutFees += delta.copyInOutFees ?? 0n;
  target.networkPaid += delta.networkPaid ?? 0n;
  target.unfilledLevelRetained += delta.unfilledLevelRetained ?? 0n;
  target.companyPerfFeeShare += delta.companyPerfFeeShare ?? 0n;
  target.grossPositive += delta.grossPositive ?? 0n;
  target.grossNegative += delta.grossNegative ?? 0n;
  target.deposits += delta.deposits ?? 0n;
  target.opsClosed += delta.opsClosed ?? 0;
  if (delta.networkByLevel) {
    for (let index = 0; index < COPY_NETWORK_LEVELS; index += 1) {
      target.networkByLevel[index] += delta.networkByLevel[index] ?? 0n;
    }
  }
}

function addNetworkLevel(target: MutableTotals, level: number, amount: bigint) {
  const index = Math.trunc(level) - 1;
  if (index < 0 || index >= COPY_NETWORK_LEVELS || amount <= 0n) return;
  target.networkByLevel[index] += amount;
  target.networkPaid += amount;
}

function bucketMap(keys: string[]) {
  const map = new Map<string, MutableTotals>();
  for (const key of keys) map.set(key, emptyTotals());
  return map;
}

function ensureBucket(map: Map<string, MutableTotals>, key: string) {
  const existing = map.get(key);
  if (existing) return existing;
  const created = emptyTotals();
  map.set(key, created);
  return created;
}

export async function getAdminCopyIncomeReport(
  period: CopyIncomePeriod,
  now = new Date(),
): Promise<AdminCopyIncomeReportDto> {
  const { from, to } = copyIncomeRange(period, now);
  const createdAt = from ? { gte: from, lte: to } : { lte: to };
  const closedAt = createdAt;

  const [config, ledgers, operations, activeAggregate] = await Promise.all([
    ensureCopyTradingConfig(),
    prisma.copyInvestmentLedger.findMany({
      where: {
        createdAt,
        OR: [
          { kind: { in: ["PLATFORM_FEE", "PERFORMANCE_FEE", "INVEST"] } },
          {
            kind: "WITHDRAWAL",
            note: { contains: "fee " },
          },
        ],
      },
      select: {
        kind: true,
        amount: true,
        note: true,
        createdAt: true,
        networkCommissions: {
          select: { level: true, amount: true },
        },
        investment: {
          select: {
            traderId: true,
            trader: { select: { name: true } },
          },
        },
      },
    }),
    prisma.copyTraderOperation.findMany({
      where: { status: "CLOSED", synthetic: false, closedAt },
      select: {
        traderId: true,
        closedAt: true,
        platformFeeMicro: true,
        performanceFeeMicro: true,
        grossPnlMicro: true,
        trader: { select: { name: true } },
      },
    }),
    prisma.copyInvestment.aggregate({
      where: { status: "ACTIVE" },
      _count: true,
      _sum: { principal: true, currentValue: true },
    }),
  ]);

  const rates = config.performanceFeeNetworkBps;
  const totals = emptyTotals();
  const buckets = bucketMap(copyIncomeBucketLabels(period, from, to));
  const traders = new Map<string, { name: string; totals: MutableTotals }>();

  const traderRow = (traderId: string, traderName: string) => {
    const existing = traders.get(traderId);
    if (existing) return existing;
    const created = { name: traderName, totals: emptyTotals() };
    traders.set(traderId, created);
    return created;
  };

  for (const row of ledgers) {
    const traderId = row.investment.traderId;
    const traderName = row.investment.trader.name;
    const bucket = ensureBucket(
      buckets,
      copyIncomeBucketKey(period, row.createdAt),
    );
    const trader = traderRow(traderId, traderName);
    if (row.kind === "PLATFORM_FEE") {
      const fee = absFeeMicro(row.amount);
      addInto(totals, { platformFees: fee });
      addInto(bucket, { platformFees: fee });
      addInto(trader.totals, { platformFees: fee });
    } else if (row.kind === "PERFORMANCE_FEE") {
      const fee = absFeeMicro(row.amount);
      const paidLevels = row.networkCommissions.map((item) => item.level);
      const retention = performanceFeeUnfilledRetention(fee, rates, paidLevels);
      const pfDelta: Partial<MutableTotals> = {
        performanceFees: fee,
        unfilledLevelRetained: retention.unfilledRetained,
        companyPerfFeeShare: retention.companyShare,
      };
      addInto(totals, pfDelta);
      addInto(bucket, pfDelta);
      addInto(trader.totals, pfDelta);
      for (const commission of row.networkCommissions) {
        const amount = absFeeMicro(commission.amount);
        addNetworkLevel(totals, commission.level, amount);
        addNetworkLevel(bucket, commission.level, amount);
        addNetworkLevel(trader.totals, commission.level, amount);
      }
    } else if (row.kind === "INVEST") {
      if (row.amount > 0n) {
        addInto(totals, { deposits: row.amount });
        addInto(bucket, { deposits: row.amount });
        addInto(trader.totals, { deposits: row.amount });
      }
      const fee = parseCopyInOutFeeMicro(row.note);
      if (fee > 0n) {
        addInto(totals, { copyInOutFees: fee });
        addInto(bucket, { copyInOutFees: fee });
        addInto(trader.totals, { copyInOutFees: fee });
      }
    } else {
      const fee = parseCopyInOutFeeMicro(row.note);
      if (fee > 0n) {
        addInto(totals, { copyInOutFees: fee });
        addInto(bucket, { copyInOutFees: fee });
        addInto(trader.totals, { copyInOutFees: fee });
      }
    }
  }

  for (const row of operations) {
    if (!row.closedAt) continue;
    const bucket = ensureBucket(
      buckets,
      copyIncomeBucketKey(period, row.closedAt),
    );
    const trader = traderRow(row.traderId, row.trader.name);
    const delta: Partial<MutableTotals> = {
      opsClosed: 1,
      grossPositive: row.grossPnlMicro > 0n ? row.grossPnlMicro : 0n,
      grossNegative: row.grossPnlMicro < 0n ? row.grossPnlMicro : 0n,
    };
    addInto(totals, delta);
    addInto(bucket, delta);
    addInto(trader.totals, delta);
  }

  const bucketRows = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, row]) => ({ bucket, ...serializeTotals(row) }));

  const traderRows = [...traders.entries()]
    .map(([traderId, row]) => ({
      traderId,
      traderName: row.name,
      ...serializeTotals(row.totals),
    }))
    .sort((a, b) => b.totalIncome - a.totalIncome);

  const copierPrincipal = activeAggregate._sum.principal ?? 0n;
  const connectedCapital = activeAggregate._sum.currentValue ?? 0n;

  return {
    period,
    from: from?.toISOString() ?? null,
    to: to.toISOString(),
    generatedAt: now.toISOString(),
    networkRatesBps: rates,
    snapshot: {
      connectedCapital: fromMicro(connectedCapital),
      copierPrincipal: fromMicro(copierPrincipal),
      copierPnl: fromMicro(connectedCapital - copierPrincipal),
      activeCopies: activeAggregate._count,
    },
    totals: serializeTotals(totals),
    buckets: bucketRows,
    traders: traderRows,
  };
}
