import type { CopyPeriod, CopyRiskLevel, PrismaClient } from "@prisma/client";

const PERIODS: CopyPeriod[] = ["TODAY", "WEEK", "MONTH", "QUARTER", "YEAR", "ALL_TIME"];

type SeedTrader = {
  id: string;
  name: string;
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
  isFeatured: boolean;
  sortOrder: number;
};

const TRADERS: SeedTrader[] = [
  {
    id: "seed-aria",
    name: "Aria Chen",
    description:
      "Momentum swing trader focused on large-cap majors. Tight risk, steady compounding.",
    riskLevel: "MEDIUM",
    experienceDays: 1310,
    profitDays: 980,
    followersCount: 12840,
    investorsCount: 742,
    aum: 4_120_000,
    totalInvested: 3_650_000,
    roiBps: 4820,
    cumulativeRoiBps: 18740,
    winRateBps: 6820,
    maxDrawdownBps: 1240,
    tradeVolume: 58_400_000,
    winningTrades: 1284,
    losingTrades: 598,
    minInvestment: 100,
    isFeatured: true,
    sortOrder: 0,
  },
  {
    id: "seed-marcus",
    name: "Marcus Reid",
    description:
      "Conservative trend-following strategy. Prioritises capital preservation over upside.",
    riskLevel: "LOW",
    experienceDays: 2190,
    profitDays: 1740,
    followersCount: 9320,
    investorsCount: 1128,
    aum: 6_780_000,
    totalInvested: 6_400_000,
    roiBps: 2140,
    cumulativeRoiBps: 12960,
    winRateBps: 7410,
    maxDrawdownBps: 640,
    tradeVolume: 41_200_000,
    winningTrades: 2140,
    losingTrades: 748,
    minInvestment: 100,
    isFeatured: true,
    sortOrder: 1,
  },
  {
    id: "seed-yuki",
    name: "Yuki Tanaka",
    description:
      "High-frequency breakout scalper. Aggressive sizing, high variance, high ceiling.",
    riskLevel: "HIGH",
    experienceDays: 720,
    profitDays: 540,
    followersCount: 18650,
    investorsCount: 516,
    aum: 2_240_000,
    totalInvested: 1_780_000,
    roiBps: 9160,
    cumulativeRoiBps: 24310,
    winRateBps: 5840,
    maxDrawdownBps: 3120,
    tradeVolume: 96_800_000,
    winningTrades: 3420,
    losingTrades: 2432,
    minInvestment: 250,
    isFeatured: false,
    sortOrder: 2,
  },
  {
    id: "seed-sofia",
    name: "Sofia Marino",
    description:
      "Mean-reversion specialist on ETH/BTC pairs. Balanced risk with consistent monthly returns.",
    riskLevel: "MEDIUM",
    experienceDays: 1560,
    profitDays: 1210,
    followersCount: 7410,
    investorsCount: 389,
    aum: 1_960_000,
    totalInvested: 1_720_000,
    roiBps: 3760,
    cumulativeRoiBps: 15420,
    winRateBps: 6410,
    maxDrawdownBps: 1580,
    tradeVolume: 33_600_000,
    winningTrades: 1640,
    losingTrades: 918,
    minInvestment: 100,
    isFeatured: false,
    sortOrder: 3,
  },
  {
    id: "seed-david",
    name: "David Okafor",
    description:
      "Macro-driven positional trader. Low turnover, patient entries, disciplined exits.",
    riskLevel: "LOW",
    experienceDays: 2740,
    profitDays: 2260,
    followersCount: 5230,
    investorsCount: 604,
    aum: 3_540_000,
    totalInvested: 3_310_000,
    roiBps: 1890,
    cumulativeRoiBps: 11240,
    winRateBps: 7020,
    maxDrawdownBps: 820,
    tradeVolume: 22_800_000,
    winningTrades: 984,
    losingTrades: 418,
    minInvestment: 100,
    isFeatured: false,
    sortOrder: 4,
  },
  {
    id: "seed-lena",
    name: "Lena Fischer",
    description:
      "Volatility harvester trading altcoin rotations. Fast, opportunistic, tightly stopped.",
    riskLevel: "HIGH",
    experienceDays: 940,
    profitDays: 690,
    followersCount: 14120,
    investorsCount: 471,
    aum: 1_480_000,
    totalInvested: 1_190_000,
    roiBps: 7320,
    cumulativeRoiBps: 20860,
    winRateBps: 6060,
    maxDrawdownBps: 2680,
    tradeVolume: 71_400_000,
    winningTrades: 2810,
    losingTrades: 1826,
    minInvestment: 250,
    isFeatured: false,
    sortOrder: 5,
  },
  {
    id: "seed-omar",
    name: "Omar Haddad",
    description:
      "Grid + DCA hybrid on majors. Steady, market-neutral bias with modest drawdowns.",
    riskLevel: "MEDIUM",
    experienceDays: 1120,
    profitDays: 860,
    followersCount: 6280,
    investorsCount: 322,
    aum: 1_310_000,
    totalInvested: 1_180_000,
    roiBps: 3210,
    cumulativeRoiBps: 13680,
    winRateBps: 6540,
    maxDrawdownBps: 1360,
    tradeVolume: 27_900_000,
    winningTrades: 1420,
    losingTrades: 752,
    minInvestment: 100,
    isFeatured: false,
    sortOrder: 6,
  },
  {
    id: "seed-nina",
    name: "Nina Kovac",
    description:
      "Systematic long-only accumulation. The lowest-variance book on the platform.",
    riskLevel: "LOW",
    experienceDays: 1980,
    profitDays: 1690,
    followersCount: 4870,
    investorsCount: 538,
    aum: 2_870_000,
    totalInvested: 2_710_000,
    roiBps: 1620,
    cumulativeRoiBps: 9840,
    winRateBps: 7280,
    maxDrawdownBps: 520,
    tradeVolume: 18_600_000,
    winningTrades: 862,
    losingTrades: 322,
    minInvestment: 100,
    isFeatured: false,
    sortOrder: 7,
  },
];

const PERIOD_FRACTION: Record<CopyPeriod, number> = {
  TODAY: 1 / 300,
  WEEK: 1 / 40,
  MONTH: 1 / 10,
  QUARTER: 1 / 3.5,
  YEAR: 1,
  ALL_TIME: 0,
};

function toMicro(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

function performanceFor(trader: SeedTrader, period: CopyPeriod): number {
  if (period === "ALL_TIME") return trader.cumulativeRoiBps;
  return Math.round(trader.roiBps * PERIOD_FRACTION[period]);
}

function chartPointsFor(trader: SeedTrader, days = 120): { date: Date; valueBps: number }[] {
  const points: { date: Date; valueBps: number }[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const progress = i / (days - 1);
    const drift = trader.cumulativeRoiBps * progress;
    const noise = Math.sin(i * 0.4 + trader.sortOrder) * trader.maxDrawdownBps * 0.15;
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - (days - 1 - i));
    points.push({ date, valueBps: Math.round(drift + noise) });
  }
  points[0].valueBps = 0;
  points[points.length - 1].valueBps = trader.cumulativeRoiBps;
  return points;
}

export async function seedCopyTraders(prisma: PrismaClient): Promise<void> {
  await prisma.copyTradingConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  for (const t of TRADERS) {
    await prisma.copyTrader.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        description: t.description,
        riskLevel: t.riskLevel,
        experienceDays: t.experienceDays,
        profitDays: t.profitDays,
        followersCount: t.followersCount,
        investorsCount: t.investorsCount,
        aum: toMicro(t.aum),
        totalInvested: toMicro(t.totalInvested),
        roiBps: t.roiBps,
        cumulativeRoiBps: t.cumulativeRoiBps,
        winRateBps: t.winRateBps,
        maxDrawdownBps: t.maxDrawdownBps,
        tradeVolume: toMicro(t.tradeVolume),
        winningTrades: t.winningTrades,
        losingTrades: t.losingTrades,
        minInvestment: toMicro(t.minInvestment),
        isActive: true,
        isVisible: true,
        isFeatured: t.isFeatured,
        sortOrder: t.sortOrder,
      },
      create: {
        id: t.id,
        name: t.name,
        description: t.description,
        riskLevel: t.riskLevel,
        experienceDays: t.experienceDays,
        profitDays: t.profitDays,
        followersCount: t.followersCount,
        investorsCount: t.investorsCount,
        aum: toMicro(t.aum),
        totalInvested: toMicro(t.totalInvested),
        roiBps: t.roiBps,
        cumulativeRoiBps: t.cumulativeRoiBps,
        winRateBps: t.winRateBps,
        maxDrawdownBps: t.maxDrawdownBps,
        tradeVolume: toMicro(t.tradeVolume),
        winningTrades: t.winningTrades,
        losingTrades: t.losingTrades,
        minInvestment: toMicro(t.minInvestment),
        isFeatured: t.isFeatured,
        sortOrder: t.sortOrder,
      },
    });

    for (const period of PERIODS) {
      await prisma.copyTraderPerformance.upsert({
        where: { traderId_period: { traderId: t.id, period } },
        update: { returnBps: performanceFor(t, period) },
        create: { traderId: t.id, period, returnBps: performanceFor(t, period) },
      });
    }

    await prisma.copyTraderChartPoint.deleteMany({ where: { traderId: t.id } });
    const chart = chartPointsFor(t);
    await prisma.copyTraderChartPoint.createMany({
      data: chart.map((p) => ({
        traderId: t.id,
        date: p.date,
        valueBps: p.valueBps,
      })),
    });
  }

  console.log(`Seeded ${TRADERS.length} copy traders with performances and chart points.`);
}
