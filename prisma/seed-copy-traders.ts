import type { CopyPeriod, CopyRiskLevel, PrismaClient } from "@prisma/client";

const PERIODS: CopyPeriod[] = [
  "TODAY",
  "WEEK",
  "MONTH",
  "QUARTER",
  "YEAR",
  "ALL_TIME",
];

type SeedSpec = {
  slug: string;
  name: string;
  description: string;
  riskLevel: CopyRiskLevel;
  roiBps: number;
  cumulativeRoiBps: number;
  aum: number;
  followersCount: number;
  investorsCount: number;
  minInvestment: number;
  isFeatured: boolean;
};

type SeedTrader = SeedSpec & {
  id: string;
  experienceDays: number;
  profitDays: number;
  totalInvested: number;
  winRateBps: number;
  maxDrawdownBps: number;
  tradeVolume: number;
  winningTrades: number;
  losingTrades: number;
  sortOrder: number;
};

const SPECS: SeedSpec[] = [
  {
    slug: "santiago-restrepo",
    name: "Santiago Restrepo",
    description:
      "Estrategia de tendencia sobre BTC y ETH. Riesgo controlado y crecimiento constante del capital.",
    riskLevel: "MEDIUM",
    roiBps: 4820,
    cumulativeRoiBps: 18740,
    aum: 4_120_000,
    followersCount: 12840,
    investorsCount: 742,
    minInvestment: 100,
    isFeatured: true,
  },
  {
    slug: "valentina-ossa",
    name: "Valentina Ossa",
    description:
      "Perfil conservador enfocado en preservar el capital. Operaciones pausadas y bajo apalancamiento.",
    riskLevel: "LOW",
    roiBps: 2140,
    cumulativeRoiBps: 12960,
    aum: 6_780_000,
    followersCount: 9320,
    investorsCount: 1128,
    minInvestment: 100,
    isFeatured: true,
  },
  {
    slug: "andres-gutierrez",
    name: "Andrés Gutiérrez",
    description:
      "Operador de rupturas de alta frecuencia. Mayor variación diaria con techo de rendimiento elevado.",
    riskLevel: "HIGH",
    roiBps: 9160,
    cumulativeRoiBps: 24310,
    aum: 2_240_000,
    followersCount: 18650,
    investorsCount: 516,
    minInvestment: 250,
    isFeatured: true,
  },
  {
    slug: "camila-herrera",
    name: "Camila Herrera",
    description:
      "Especialista en reversión a la media sobre pares ETH/BTC. Resultados mensuales estables.",
    riskLevel: "MEDIUM",
    roiBps: 3760,
    cumulativeRoiBps: 15420,
    aum: 1_960_000,
    followersCount: 7410,
    investorsCount: 389,
    minInvestment: 100,
    isFeatured: false,
  },
  {
    slug: "juan-pablo-mejia",
    name: "Juan Pablo Mejía",
    description:
      "Enfoque macro y posiciones de largo plazo. Pocas operaciones, entradas pacientes y salidas disciplinadas.",
    riskLevel: "LOW",
    roiBps: 1890,
    cumulativeRoiBps: 11240,
    aum: 3_540_000,
    followersCount: 5230,
    investorsCount: 604,
    minInvestment: 100,
    isFeatured: false,
  },
  {
    slug: "daniela-cardenas",
    name: "Daniela Cárdenas",
    description:
      "Aprovecha la volatilidad en rotaciones de altcoins. Rápida, oportunista y con stops ajustados.",
    riskLevel: "HIGH",
    roiBps: 7320,
    cumulativeRoiBps: 20860,
    aum: 1_480_000,
    followersCount: 14120,
    investorsCount: 471,
    minInvestment: 250,
    isFeatured: false,
  },
  {
    slug: "mateo-villegas",
    name: "Mateo Villegas",
    description:
      "Sistema híbrido de grilla y DCA sobre las principales monedas. Sesgo neutral y caídas moderadas.",
    riskLevel: "MEDIUM",
    roiBps: 3210,
    cumulativeRoiBps: 13680,
    aum: 1_310_000,
    followersCount: 6280,
    investorsCount: 322,
    minInvestment: 100,
    isFeatured: false,
  },
  {
    slug: "laura-betancur",
    name: "Laura Betancur",
    description:
      "Acumulación sistemática en posiciones largas. El perfil con menor variación de la plataforma.",
    riskLevel: "LOW",
    roiBps: 1620,
    cumulativeRoiBps: 9840,
    aum: 2_870_000,
    followersCount: 4870,
    investorsCount: 538,
    minInvestment: 100,
    isFeatured: false,
  },
  {
    slug: "sebastian-arango",
    name: "Sebastián Arango",
    description:
      "Operativa intradía sobre BTC con gestión activa del riesgo por operación.",
    riskLevel: "MEDIUM",
    roiBps: 4180,
    cumulativeRoiBps: 16250,
    aum: 2_610_000,
    followersCount: 8940,
    investorsCount: 455,
    minInvestment: 100,
    isFeatured: false,
  },
  {
    slug: "manuela-zapata",
    name: "Manuela Zapata",
    description:
      "Cartera diversificada entre las diez principales monedas. Rebalanceo semanal automático.",
    riskLevel: "LOW",
    roiBps: 2320,
    cumulativeRoiBps: 10870,
    aum: 3_980_000,
    followersCount: 6120,
    investorsCount: 689,
    minInvestment: 100,
    isFeatured: false,
  },
  {
    slug: "carlos-andres-pena",
    name: "Carlos Andrés Peña",
    description:
      "Seguimiento de impulso en marcos de tiempo cortos. Busca movimientos fuertes del mercado.",
    riskLevel: "HIGH",
    roiBps: 8240,
    cumulativeRoiBps: 22140,
    aum: 1_720_000,
    followersCount: 15380,
    investorsCount: 498,
    minInvestment: 250,
    isFeatured: false,
  },
  {
    slug: "isabella-moreno",
    name: "Isabella Moreno",
    description:
      "Estrategia de rangos con toma de ganancias escalonada. Ideal para perfiles equilibrados.",
    riskLevel: "MEDIUM",
    roiBps: 3540,
    cumulativeRoiBps: 14360,
    aum: 2_040_000,
    followersCount: 7060,
    investorsCount: 364,
    minInvestment: 100,
    isFeatured: false,
  },
  {
    slug: "nicolas-salazar",
    name: "Nicolás Salazar",
    description:
      "Operativa de continuación de tendencia con filtros de volumen. Baja rotación de cartera.",
    riskLevel: "LOW",
    roiBps: 1980,
    cumulativeRoiBps: 10420,
    aum: 3_120_000,
    followersCount: 5640,
    investorsCount: 572,
    minInvestment: 100,
    isFeatured: false,
  },
  {
    slug: "sara-jaramillo",
    name: "Sara Jaramillo",
    description:
      "Combina análisis técnico y gestión estricta del riesgo. Prioriza la consistencia mensual.",
    riskLevel: "MEDIUM",
    roiBps: 3980,
    cumulativeRoiBps: 15780,
    aum: 2_360_000,
    followersCount: 8210,
    investorsCount: 412,
    minInvestment: 100,
    isFeatured: false,
  },
  {
    slug: "felipe-ocampo",
    name: "Felipe Ocampo",
    description:
      "Operador agresivo en mercados con alta volatilidad. Resultados variables y potencial elevado.",
    riskLevel: "HIGH",
    roiBps: 8760,
    cumulativeRoiBps: 23480,
    aum: 1_540_000,
    followersCount: 16240,
    investorsCount: 487,
    minInvestment: 250,
    isFeatured: false,
  },
  {
    slug: "mariana-quintero",
    name: "Mariana Quintero",
    description:
      "Cartera defensiva con exposición gradual. Pensada para quienes inician en copy trading.",
    riskLevel: "LOW",
    roiBps: 1740,
    cumulativeRoiBps: 9460,
    aum: 2_680_000,
    followersCount: 4520,
    investorsCount: 517,
    minInvestment: 100,
    isFeatured: false,
  },
  {
    slug: "julian-castano",
    name: "Julián Castaño",
    description:
      "Estrategia mixta entre tendencia y rango, con ajuste dinámico del tamaño de posición.",
    riskLevel: "MEDIUM",
    roiBps: 4360,
    cumulativeRoiBps: 17120,
    aum: 2_840_000,
    followersCount: 9480,
    investorsCount: 468,
    minInvestment: 100,
    isFeatured: false,
  },
  {
    slug: "paula-andrea-rojas",
    name: "Paula Andrea Rojas",
    description:
      "Operativa de swing sobre las principales criptomonedas. Objetivo de crecimiento sostenido.",
    riskLevel: "MEDIUM",
    roiBps: 3680,
    cumulativeRoiBps: 14920,
    aum: 2_180_000,
    followersCount: 7620,
    investorsCount: 386,
    minInvestment: 100,
    isFeatured: false,
  },
  {
    slug: "esteban-vargas",
    name: "Esteban Vargas",
    description:
      "Estrategia de alta rotación con objetivos cortos por operación. Requiere tolerancia al riesgo.",
    riskLevel: "HIGH",
    roiBps: 7840,
    cumulativeRoiBps: 21360,
    aum: 1_620_000,
    followersCount: 14860,
    investorsCount: 462,
    minInvestment: 250,
    isFeatured: false,
  },
  {
    slug: "catalina-duque",
    name: "Catalina Duque",
    description:
      "Gestión pasiva con revisión semanal de posiciones. Enfoque de largo plazo y bajo mantenimiento.",
    riskLevel: "LOW",
    roiBps: 2060,
    cumulativeRoiBps: 11080,
    aum: 3_360_000,
    followersCount: 5980,
    investorsCount: 631,
    minInvestment: 100,
    isFeatured: false,
  },
];

const RISK_PROFILE: Record<
  CopyRiskLevel,
  {
    winRateBps: number;
    maxDrawdownBps: number;
    volumeFactor: number;
    profitRatio: number;
    simulationMinBps: number;
    simulationMaxBps: number;
  }
> = {
  LOW: {
    winRateBps: 7200,
    maxDrawdownBps: 620,
    volumeFactor: 8,
    profitRatio: 0.72,
    simulationMinBps: -40,
    simulationMaxBps: 80,
  },
  MEDIUM: {
    winRateBps: 6480,
    maxDrawdownBps: 1420,
    volumeFactor: 14,
    profitRatio: 0.66,
    simulationMinBps: -90,
    simulationMaxBps: 150,
  },
  HIGH: {
    winRateBps: 5860,
    maxDrawdownBps: 2940,
    volumeFactor: 26,
    profitRatio: 0.58,
    simulationMinBps: -180,
    simulationMaxBps: 260,
  },
};

/** Expands a spec into full display stats so the seed table stays readable. */
function expand(spec: SeedSpec, index: number): SeedTrader {
  const profile = RISK_PROFILE[spec.riskLevel];
  const experienceDays = 540 + index * 97;
  const totalTrades = 640 + index * 83 + profile.volumeFactor * 24;
  const winningTrades = Math.round((totalTrades * profile.winRateBps) / 10_000);

  return {
    ...spec,
    id: `seed-${spec.slug}`,
    experienceDays,
    profitDays: Math.round(experienceDays * profile.profitRatio),
    totalInvested: Math.round(spec.aum * 0.92),
    winRateBps: profile.winRateBps + ((index * 37) % 260),
    maxDrawdownBps: profile.maxDrawdownBps + ((index * 53) % 180),
    tradeVolume: spec.aum * profile.volumeFactor,
    winningTrades,
    losingTrades: totalTrades - winningTrades,
    sortOrder: index,
  };
}

const TRADERS: SeedTrader[] = SPECS.map(expand);

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

function chartPointsFor(
  trader: SeedTrader,
  days = 120,
): { date: Date; valueBps: number }[] {
  const points: { date: Date; valueBps: number }[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const progress = i / (days - 1);
    const drift = trader.cumulativeRoiBps * progress;
    const noise =
      Math.sin(i * 0.4 + trader.sortOrder) * trader.maxDrawdownBps * 0.15;
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (days - 1 - i));
    points.push({ date, valueBps: Math.round(drift + noise) });
  }
  points[0].valueBps = 0;
  points[points.length - 1].valueBps = trader.cumulativeRoiBps;
  return points;
}

/**
 * Idempotent seed. New traders get their full starting stats and equity curve;
 * traders that already exist only have profile/config fields refreshed, so
 * accumulated results from the performance engine are never reset.
 */
export async function seedCopyTraders(prisma: PrismaClient): Promise<void> {
  await prisma.copyTradingConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  let created = 0;
  let refreshed = 0;

  for (const t of TRADERS) {
    const profile = RISK_PROFILE[t.riskLevel];
    const existing = await prisma.copyTrader.findUnique({
      where: { id: t.id },
    });

    if (existing) {
      await prisma.copyTrader.update({
        where: { id: t.id },
        data: {
          name: t.name,
          description: t.description,
          riskLevel: t.riskLevel,
          minInvestment: toMicro(t.minInvestment),
          isActive: true,
          isVisible: true,
          isFeatured: t.isFeatured,
          sortOrder: t.sortOrder,
        },
      });
      refreshed++;
      continue;
    }

    await prisma.copyTrader.create({
      data: {
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
        simulationEnabled: true,
        simulationMinBps: profile.simulationMinBps,
        simulationMaxBps: profile.simulationMaxBps,
        simulationIntervalHours: 24,
        simulationNextRunAt: new Date(),
      },
    });

    for (const period of PERIODS) {
      await prisma.copyTraderPerformance.create({
        data: { traderId: t.id, period, returnBps: performanceFor(t, period) },
      });
    }

    await prisma.copyTraderChartPoint.createMany({
      data: chartPointsFor(t).map((p) => ({
        traderId: t.id,
        date: p.date,
        valueBps: p.valueBps,
      })),
      skipDuplicates: true,
    });

    created++;
  }

  // Retire seed traders from earlier revisions instead of deleting them, so any
  // existing investment/ledger rows keep their foreign keys intact.
  const retired = await prisma.copyTrader.updateMany({
    where: {
      id: { startsWith: "seed-" },
      NOT: { id: { in: TRADERS.map((t) => t.id) } },
    },
    data: { isActive: false, isVisible: false, simulationEnabled: false },
  });

  console.log(
    `Copy traders — created: ${created}, refreshed: ${refreshed}, retired: ${retired.count}.`,
  );
}
