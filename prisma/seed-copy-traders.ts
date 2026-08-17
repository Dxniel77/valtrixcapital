import type { CopyPeriod, CopyRiskLevel, PrismaClient } from "@prisma/client";

/**
 * Copy-trading catalog generator.
 *
 * Produces a large, global, believable marketplace of simulated traders:
 *  - ~158 traders across many countries (not a single locale)
 *  - a realistic outcome mix: ~30% end the year down, exactly 3 are extreme
 *    "crazy" high-risk profiles (1 winner and 2 losers)
 *  - equity curves that genuinely rise AND fall, with amplitude and drawdown
 *    scaled to each trader's risk level
 *  - the strongest headline returns concentrated in HIGH risk, so an admin can
 *    steer attention by risk level
 *
 * Everything is deterministic (seeded from a fixed string), so re-running always
 * rebuilds the exact same catalog. Only presentational data is generated here;
 * investor money lives in separate tables that this file never touches.
 */

const PERIODS: CopyPeriod[] = ["TODAY", "WEEK", "MONTH", "QUARTER", "YEAR", "ALL_TIME"];

/** One year of daily equity points backs every published period return. */
const HISTORY_DAYS = 365;

const CATALOG_SIZE = 158;

// ------------------------------------------------------------
// Deterministic randomness
// ------------------------------------------------------------

function createRng(seed: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Uniform integer in [min, max]. */
function intBetween(rng: () => number, min: number, max: number): number {
  return Math.round(min + rng() * (max - min));
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

/** Deterministic Fisher–Yates shuffle. */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ------------------------------------------------------------
// Countries + name pools (global marketplace)
// ------------------------------------------------------------

type Country = {
  code: string;
  name: string;
  /** Relative frequency in the catalog. */
  weight: number;
  firsts: string[];
  lasts: string[];
};

const COUNTRIES: Country[] = [
  {
    code: "CO",
    name: "Colombia",
    weight: 5,
    firsts: ["Santiago", "Valentina", "Andrés", "Camila", "Juan Pablo", "Daniela", "Mateo", "Laura", "Sebastián", "Manuela"],
    lasts: ["Restrepo", "Ossa", "Gutiérrez", "Herrera", "Mejía", "Cárdenas", "Villegas", "Betancur", "Arango", "Zapata"],
  },
  {
    code: "MX",
    name: "México",
    weight: 3,
    firsts: ["Diego", "Fernanda", "Emiliano", "Ximena", "Alejandro", "Regina", "Rodrigo", "Valeria"],
    lasts: ["Hernández", "García", "Martínez", "López", "Ramírez", "Torres", "Flores", "Vázquez"],
  },
  {
    code: "BR",
    name: "Brasil",
    weight: 3,
    firsts: ["Lucas", "Beatriz", "Gabriel", "Larissa", "Rafael", "Camila", "Thiago", "Juliana"],
    lasts: ["Silva", "Souza", "Oliveira", "Santos", "Pereira", "Almeida", "Costa", "Ribeiro"],
  },
  {
    code: "AR",
    name: "Argentina",
    weight: 2,
    firsts: ["Nicolás", "Sofía", "Tomás", "Martina", "Joaquín", "Lucía", "Bruno", "Agustina"],
    lasts: ["Fernández", "González", "Rodríguez", "Romero", "Sosa", "Díaz", "Álvarez", "Benítez"],
  },
  {
    code: "US",
    name: "United States",
    weight: 4,
    firsts: ["James", "Emily", "Michael", "Olivia", "Daniel", "Ava", "Ethan", "Sophia", "Ryan", "Grace"],
    lasts: ["Carter", "Bennett", "Sullivan", "Parker", "Coleman", "Hayes", "Brooks", "Morgan", "Reed", "Foster"],
  },
  {
    code: "GB",
    name: "United Kingdom",
    weight: 2,
    firsts: ["Oliver", "Charlotte", "Harry", "Amelia", "George", "Isla", "Jack", "Freya"],
    lasts: ["Walker", "Wright", "Thompson", "Clarke", "Hughes", "Baker", "Turner", "Ward"],
  },
  {
    code: "DE",
    name: "Deutschland",
    weight: 2,
    firsts: ["Lukas", "Hannah", "Felix", "Emma", "Jonas", "Mia", "Leon", "Lena"],
    lasts: ["Müller", "Schmidt", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann", "Schäfer"],
  },
  {
    code: "FR",
    name: "France",
    weight: 2,
    firsts: ["Louis", "Camille", "Hugo", "Chloé", "Nathan", "Léa", "Gabriel", "Manon"],
    lasts: ["Martin", "Bernard", "Dubois", "Laurent", "Moreau", "Girard", "Lefèvre", "Rousseau"],
  },
  {
    code: "ES",
    name: "España",
    weight: 2,
    firsts: ["Pablo", "Lucía", "Álvaro", "María", "Javier", "Carmen", "Marcos", "Paula"],
    lasts: ["García", "Fernández", "Rodríguez", "Moreno", "Jiménez", "Ruiz", "Navarro", "Molina"],
  },
  {
    code: "IT",
    name: "Italia",
    weight: 2,
    firsts: ["Marco", "Giulia", "Alessandro", "Sofia", "Matteo", "Chiara", "Lorenzo", "Martina"],
    lasts: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Greco"],
  },
  {
    code: "IN",
    name: "India",
    weight: 3,
    firsts: ["Arjun", "Priya", "Rohan", "Ananya", "Vikram", "Isha", "Aditya", "Neha"],
    lasts: ["Sharma", "Patel", "Reddy", "Nair", "Iyer", "Kapoor", "Mehta", "Gupta"],
  },
  {
    code: "JP",
    name: "日本",
    weight: 2,
    firsts: ["Haruto", "Yui", "Sota", "Hina", "Ren", "Aoi", "Riku", "Mio"],
    lasts: ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura"],
  },
  {
    code: "KR",
    name: "대한민국",
    weight: 2,
    firsts: ["Minjun", "Seoyeon", "Jiho", "Hana", "Jisung", "Yuna", "Doyoon", "Eunseo"],
    lasts: ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon"],
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    weight: 2,
    firsts: ["Omar", "Layla", "Khalid", "Aisha", "Yousef", "Fatima", "Hamdan", "Noor"],
    lasts: ["Al Mansoori", "Al Nuaimi", "Al Farsi", "Al Hashimi", "Al Zaabi", "Al Rashed", "Haddad", "Nassar"],
  },
  {
    code: "SG",
    name: "Singapore",
    weight: 2,
    firsts: ["Wei", "Hui", "Jun", "Mei", "Zhi", "Xin", "Kai", "Ling"],
    lasts: ["Tan", "Lim", "Lee", "Ng", "Wong", "Goh", "Chua", "Koh"],
  },
  {
    code: "NG",
    name: "Nigeria",
    weight: 2,
    firsts: ["Chidi", "Amara", "Emeka", "Ngozi", "Tunde", "Zainab", "Ifeanyi", "Adaeze"],
    lasts: ["Okafor", "Adeyemi", "Okoro", "Balogun", "Eze", "Abubakar", "Nwosu", "Olawale"],
  },
  {
    code: "ZA",
    name: "South Africa",
    weight: 1,
    firsts: ["Liam", "Ayanda", "Sipho", "Lerato", "Johan", "Thandi", "Pieter", "Naledi"],
    lasts: ["Botha", "Nkosi", "Van der Merwe", "Dlamini", "Pretorius", "Mokoena", "Naidoo", "Khumalo"],
  },
  {
    code: "TR",
    name: "Türkiye",
    weight: 1,
    firsts: ["Mehmet", "Elif", "Emre", "Zeynep", "Burak", "Ayşe", "Kaan", "Merve"],
    lasts: ["Yılmaz", "Demir", "Kaya", "Çelik", "Şahin", "Aydın", "Öztürk", "Arslan"],
  },
];

// ------------------------------------------------------------
// Descriptions (localized-feeling, style-based)
// ------------------------------------------------------------

const STYLES: { key: string; es: string; en: string }[] = [
  { key: "trend", es: "Estrategia de tendencia sobre BTC y ETH con gestión de riesgo por operación.", en: "Trend-following on BTC and ETH with per-trade risk management." },
  { key: "breakout", es: "Operativa de rupturas de alta frecuencia buscando movimientos fuertes.", en: "High-frequency breakout trading that hunts strong momentum moves." },
  { key: "meanrev", es: "Reversión a la media sobre pares principales. Entradas pacientes.", en: "Mean-reversion on major pairs with patient entries." },
  { key: "macro", es: "Enfoque macro y posiciones de largo plazo con baja rotación.", en: "Macro-driven long-term positioning with low turnover." },
  { key: "grid", es: "Sistema de grilla y DCA sobre las principales monedas.", en: "Grid and DCA system across the top coins." },
  { key: "scalp", es: "Scalping intradía con stops ajustados y toma rápida de ganancias.", en: "Intraday scalping with tight stops and fast profit-taking." },
  { key: "swing", es: "Swing trading de varios días siguiendo la estructura del mercado.", en: "Multi-day swing trading that follows market structure." },
  { key: "momentum", es: "Seguimiento de impulso en marcos de tiempo cortos.", en: "Momentum following on short timeframes." },
  { key: "defensive", es: "Cartera defensiva con exposición gradual y bajo apalancamiento.", en: "Defensive book with gradual exposure and low leverage." },
  { key: "rotation", es: "Rotación entre altcoins aprovechando la volatilidad del sector.", en: "Altcoin rotation that exploits sector volatility." },
];

// ------------------------------------------------------------
// Risk + outcome model
// ------------------------------------------------------------

const RISK_BASE: Record<
  CopyRiskLevel,
  {
    dailyVolBps: number;
    maxDrawdownCapBps: number;
    winRateBaselineBps: number;
    volumeFactor: number;
    profitRatio: number;
    simulationMinBps: number;
    simulationMaxBps: number;
    minInvestment: number;
  }
> = {
  LOW: {
    dailyVolBps: 34,
    maxDrawdownCapBps: 700,
    winRateBaselineBps: 7000,
    volumeFactor: 8,
    profitRatio: 0.72,
    simulationMinBps: -40,
    simulationMaxBps: 80,
    minInvestment: 15,
  },
  MEDIUM: {
    dailyVolBps: 88,
    maxDrawdownCapBps: 1800,
    winRateBaselineBps: 6300,
    volumeFactor: 14,
    profitRatio: 0.64,
    simulationMinBps: -90,
    simulationMaxBps: 150,
    minInvestment: 15,
  },
  HIGH: {
    dailyVolBps: 180,
    maxDrawdownCapBps: 3800,
    winRateBaselineBps: 5600,
    volumeFactor: 26,
    profitRatio: 0.56,
    simulationMinBps: -180,
    simulationMaxBps: 260,
    minInvestment: 15,
  },
};

type Outcome = "CRAZY_WIN" | "CRAZY_LOSS" | "STRONG" | "GOOD" | "MODEST" | "LOSER";

/** Exact composition of the 158-trader catalog. */
const OUTCOME_COUNTS: Record<Outcome, number> = {
  CRAZY_WIN: 1,
  CRAZY_LOSS: 2,
  // The standard "best trader" cohort: 15 HIGH, 9 MEDIUM, 6 LOW.
  STRONG: 30,
  GOOD: 40,
  MODEST: 40,
  LOSER: 45,
};

/** Risk weighting per outcome — the best results skew HIGH. */
const RISK_WEIGHTS: Record<Outcome, [CopyRiskLevel, number][]> = {
  CRAZY_WIN: [["HIGH", 1]],
  CRAZY_LOSS: [["HIGH", 1]],
  // STRONG uses an exact quota in buildRiskOrder; these weights are fallback only.
  STRONG: [["HIGH", 0.5], ["MEDIUM", 0.3], ["LOW", 0.2]],
  GOOD: [["HIGH", 0.3], ["MEDIUM", 0.45], ["LOW", 0.25]],
  MODEST: [["HIGH", 0.1], ["MEDIUM", 0.4], ["LOW", 0.5]],
  LOSER: [["HIGH", 0.35], ["MEDIUM", 0.4], ["LOW", 0.25]],
};

function chooseRisk(rng: () => number, outcome: Outcome): CopyRiskLevel {
  const weights = RISK_WEIGHTS[outcome];
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [risk, w] of weights) {
    if (roll < w) return risk;
    roll -= w;
  }
  return weights[weights.length - 1][0];
}

/**
 * Pre-assigns risk levels per outcome. The best standard cohort must have an
 * exact 50/30/20 split rather than merely approximating it through randomness.
 */
function buildRiskOrder(
  rng: () => number,
  outcome: Outcome,
  count: number,
): CopyRiskLevel[] {
  if (outcome === "STRONG") {
    return shuffle(
      [
        ...Array<CopyRiskLevel>(15).fill("HIGH"),
        ...Array<CopyRiskLevel>(9).fill("MEDIUM"),
        ...Array<CopyRiskLevel>(6).fill("LOW"),
      ],
      rng,
    );
  }

  return Array.from({ length: count }, () => chooseRisk(rng, outcome));
}

/**
 * Worst allowed all-time result. A copy account can't lose more than its
 * capital, so we floor the downside near "nearly blew up" rather than the
 * impossible sub-100% figures a raw walk can produce.
 */
const MAX_LOSS_BPS = -7_800;

/** All-time cumulative return, in bps, for an outcome/risk pair. */
function cumulativeFor(rng: () => number, outcome: Outcome, risk: CopyRiskLevel): number {
  switch (outcome) {
    case "CRAZY_WIN":
      return intBetween(rng, 18_000, 30_000);
    case "CRAZY_LOSS":
      return -intBetween(rng, 5_200, 7_600);
    case "STRONG":
      if (risk === "HIGH") return intBetween(rng, 9_000, 17_000);
      if (risk === "MEDIUM") return intBetween(rng, 6_000, 10_500);
      return intBetween(rng, 3_600, 6_000);
    case "GOOD":
      if (risk === "HIGH") return intBetween(rng, 5_000, 9_000);
      if (risk === "MEDIUM") return intBetween(rng, 3_200, 6_000);
      return intBetween(rng, 2_200, 3_800);
    case "MODEST":
      if (risk === "HIGH") return intBetween(rng, 1_200, 4_500);
      if (risk === "MEDIUM") return intBetween(rng, 700, 3_000);
      return intBetween(rng, 400, 2_200);
    case "LOSER":
      if (risk === "HIGH") return Math.max(MAX_LOSS_BPS, -intBetween(rng, 3_200, 7_400));
      if (risk === "MEDIUM") return -intBetween(rng, 1_400, 5_200);
      return -intBetween(rng, 300, 2_400);
  }
}

// ------------------------------------------------------------
// Equity curve generation
// ------------------------------------------------------------

type TraderHistory = {
  curve: number[];
  dailyReturns: number[];
  maxDrawdownBps: number;
  winRateBps: number;
};

/** Builds the cumulative curve, damping each day's deviation from the trend. */
function accumulate(dailyReturns: number[], target: number, amplitude: number): number[] {
  const drift = target / dailyReturns.length;
  const curve: number[] = [0];
  let running = 0;
  for (const value of dailyReturns) {
    running += (value - drift) * amplitude + drift;
    curve.push(Math.round(running));
  }
  curve[curve.length - 1] = target;
  return curve;
}

function drawdownOf(curve: number[]): number {
  let peak = curve[0];
  let worst = 0;
  for (const value of curve) {
    if (value > peak) peak = value;
    worst = Math.max(worst, peak - value);
  }
  return worst;
}

/**
 * A random walk through alternating bullish / bearish / sideways regimes,
 * shifted to land on `cumulativeRoiBps` and damped until the deepest decline
 * fits `maxDrawdownCapBps`. Volatility drives amplitude, so every trader has
 * losing stretches no matter how the year ends.
 */
function buildHistory(
  seed: string,
  cumulativeRoiBps: number,
  dailyVolBps: number,
  maxDrawdownCapBps: number,
  days = HISTORY_DAYS,
): TraderHistory {
  const rng = createRng(`curve:${seed}`);

  const raw: number[] = [];
  while (raw.length < days) {
    const regimeLength = 10 + Math.floor(rng() * 30);
    const roll = rng();
    const mu = roll < 0.42 ? dailyVolBps * 0.34 : roll < 0.76 ? -dailyVolBps * 0.36 : 0;
    for (let i = 0; i < regimeLength && raw.length < days; i++) {
      raw.push(mu + gaussian(rng) * dailyVolBps);
    }
  }

  const rawTotal = raw.reduce((sum, value) => sum + value, 0);
  const correction = (cumulativeRoiBps - rawTotal) / days;
  const centered = raw.map((value) => value + correction);

  // A trader who ends down is already in a drawdown at least that deep, so the
  // cap has to leave room for it — but never imply a >95% (impossible) loss.
  const cap = Math.min(
    9_500,
    Math.max(maxDrawdownCapBps, cumulativeRoiBps < 0 ? -cumulativeRoiBps * 1.12 : 0),
  );

  let amplitude = 1;
  let curve = accumulate(centered, cumulativeRoiBps, amplitude);
  for (let attempt = 0; attempt < 8; attempt++) {
    const drawdown = drawdownOf(curve);
    if (drawdown <= cap) break;
    amplitude *= cap / drawdown;
    curve = accumulate(centered, cumulativeRoiBps, amplitude);
  }

  const drift = cumulativeRoiBps / days;
  const dailyReturns =
    amplitude === 1
      ? centered
      : centered.map((value) => (value - drift) * amplitude + drift);

  const positiveDays = dailyReturns.filter((value) => value > 0).length;
  const dayRateBps = (positiveDays / dailyReturns.length) * 10_000;

  return {
    curve,
    dailyReturns,
    maxDrawdownBps: drawdownOf(curve),
    winRateBps: Math.round(dayRateBps * 0.45 + 6300 * 0.55),
  };
}

function windowReturn(curve: number[], days: number): number {
  const end = curve[curve.length - 1];
  const start = curve[Math.max(0, curve.length - 1 - days)];
  return end - start;
}

function performanceFor(curve: number[], period: CopyPeriod): number {
  switch (period) {
    case "TODAY":
      return windowReturn(curve, 1);
    case "WEEK":
      return windowReturn(curve, 7);
    case "MONTH":
      return windowReturn(curve, 30);
    case "QUARTER":
      return windowReturn(curve, 90);
    case "YEAR":
      return windowReturn(curve, 365);
    case "ALL_TIME":
      return curve[curve.length - 1];
  }
}

// ------------------------------------------------------------
// Trader assembly
// ------------------------------------------------------------

type SeedTrader = {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  description: string;
  riskLevel: CopyRiskLevel;
  outcome: Outcome;
  history: TraderHistory;
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
  simulationMinBps: number;
  simulationMaxBps: number;
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Builds the ordered list of outcomes, one per trader, then interleaves them. */
function buildOutcomeOrder(rng: () => number): Outcome[] {
  const list: Outcome[] = [];
  (Object.keys(OUTCOME_COUNTS) as Outcome[]).forEach((outcome) => {
    for (let i = 0; i < OUTCOME_COUNTS[outcome]; i++) list.push(outcome);
  });
  return shuffle(list, rng);
}

/** Builds the country assignment, weighted and shuffled, to `count` entries. */
function buildCountryOrder(rng: () => number, count: number): Country[] {
  const pool: Country[] = [];
  COUNTRIES.forEach((country) => {
    for (let i = 0; i < country.weight; i++) pool.push(country);
  });
  const order: Country[] = [];
  const shuffled = shuffle(pool, rng);
  for (let i = 0; i < count; i++) order.push(shuffled[i % shuffled.length]);
  return shuffle(order, rng);
}

function generateTraders(): SeedTrader[] {
  const rng = createRng("valtrix-copy-catalog-v2");
  const outcomes = buildOutcomeOrder(rng);
  const countries = buildCountryOrder(rng, CATALOG_SIZE);
  const risksByOutcome = Object.fromEntries(
    (Object.keys(OUTCOME_COUNTS) as Outcome[]).map((outcome) => [
      outcome,
      buildRiskOrder(rng, outcome, OUTCOME_COUNTS[outcome]),
    ]),
  ) as Record<Outcome, CopyRiskLevel[]>;
  const riskIndex = Object.fromEntries(
    (Object.keys(OUTCOME_COUNTS) as Outcome[]).map((outcome) => [outcome, 0]),
  ) as Record<Outcome, number>;
  const usedNames = new Set<string>();
  const usedSlugs = new Set<string>();

  const traders: SeedTrader[] = [];

  for (let index = 0; index < CATALOG_SIZE; index++) {
    const outcome = outcomes[index];
    const country = countries[index];
    const risk = risksByOutcome[outcome][riskIndex[outcome]++];
    const base = RISK_BASE[risk];
    const crazy = outcome === "CRAZY_WIN" || outcome === "CRAZY_LOSS";

    // Unique name.
    let name = "";
    for (let attempt = 0; attempt < 40; attempt++) {
      const candidate = `${pick(rng, country.firsts)} ${pick(rng, country.lasts)}`;
      if (!usedNames.has(candidate)) {
        name = candidate;
        break;
      }
    }
    if (!name) name = `${pick(rng, country.firsts)} ${pick(rng, country.lasts)} ${index}`;
    usedNames.add(name);

    let slug = `${country.code.toLowerCase()}-${slugify(name)}`;
    let suffix = 2;
    while (usedSlugs.has(slug)) slug = `${country.code.toLowerCase()}-${slugify(name)}-${suffix++}`;
    usedSlugs.add(slug);

    const cumulativeRoiBps = cumulativeFor(rng, outcome, risk);
    const volMult = crazy ? 1.9 : 1;
    const capMult = crazy ? 2.4 : 1;
    const history = buildHistory(
      slug,
      cumulativeRoiBps,
      base.dailyVolBps * volMult,
      base.maxDrawdownCapBps * capMult,
    );

    const style = pick(rng, STYLES);
    const description = country.code === "US" || country.code === "GB" ? style.en : style.es;

    // Fame scales with how attractive the outcome is.
    const fame =
      outcome === "CRAZY_WIN" ? 1 :
      outcome === "STRONG" ? 0.82 :
      outcome === "GOOD" ? 0.55 :
      outcome === "MODEST" ? 0.32 :
      outcome === "CRAZY_LOSS" ? 0.5 :
      0.28;

    const followersCount = intBetween(rng, 600, 24_000) * (0.4 + fame) | 0;
    const investorsCount = Math.max(12, Math.round(followersCount * (0.03 + rng() * 0.05)));
    const aum = intBetween(rng, 180_000, 6_400_000) * (0.35 + fame);
    const experienceDays = intBetween(rng, 380, 2_200);
    const totalTrades = intBetween(rng, 480, 2_600) + base.volumeFactor * 20;
    const winningTrades = Math.round((totalTrades * history.winRateBps) / 10_000);

    traders.push({
      id: `seed-${slug}`,
      name,
      countryCode: country.code,
      countryName: country.name,
      description,
      riskLevel: risk,
      outcome,
      history,
      experienceDays,
      profitDays: Math.round(experienceDays * base.profitRatio * (cumulativeRoiBps < 0 ? 0.82 : 1)),
      followersCount,
      investorsCount,
      aum: Math.round(aum),
      totalInvested: Math.round(aum * 0.92),
      roiBps: windowReturn(history.curve, 30),
      cumulativeRoiBps,
      winRateBps: history.winRateBps,
      maxDrawdownBps: history.maxDrawdownBps,
      tradeVolume: Math.round(aum * base.volumeFactor),
      winningTrades,
      losingTrades: totalTrades - winningTrades,
      minInvestment: base.minInvestment,
      isFeatured: outcome === "CRAZY_WIN" || (outcome === "STRONG" && risk === "HIGH" && rng() < 0.35),
      sortOrder: index,
      simulationMinBps: Math.round(base.simulationMinBps * volMult),
      simulationMaxBps: Math.round(base.simulationMaxBps * volMult),
    });
  }

  return traders;
}

const TRADERS: SeedTrader[] = generateTraders();

// ------------------------------------------------------------
// Persistence
// ------------------------------------------------------------

function toMicro(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

function chartPointsFor(trader: SeedTrader): { date: Date; valueBps: number }[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const total = trader.history.curve.length;
  return trader.history.curve.map((valueBps, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (total - 1 - index));
    return { date, valueBps };
  });
}

/**
 * Idempotent catalog seed. New traders get full starting stats and equity
 * curve; existing traders only have profile/config fields refreshed so results
 * accumulated by the performance engine are never reset. Traders from older
 * catalog revisions are hidden (never deleted) to preserve foreign keys.
 */
export async function seedCopyTraders(prisma: PrismaClient): Promise<void> {
  await prisma.copyTradingConfig.upsert({
    where: { id: 1 },
    update: { globalMinInvestment: toMicro(15) },
    create: { id: 1, globalMinInvestment: toMicro(15) },
  });

  let created = 0;
  let refreshed = 0;

  for (const t of TRADERS) {
    const existing = await prisma.copyTrader.findUnique({ where: { id: t.id } });

    if (existing) {
      await prisma.copyTrader.update({
        where: { id: t.id },
        data: {
          name: t.name,
          description: t.description,
          countryCode: t.countryCode,
          countryName: t.countryName,
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
        countryCode: t.countryCode,
        countryName: t.countryName,
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
        simulationMinBps: t.simulationMinBps,
        simulationMaxBps: t.simulationMaxBps,
        simulationIntervalHours: 24,
        simulationMinOpsPerDay: 8,
        simulationMaxOpsPerDay: 20,
        simulationDurationMinMinutes: 3,
        simulationDurationMaxMinutes: 10,
        simulationNextRunAt: new Date(),
        nextOperationAt: new Date(),
      },
    });

    for (const period of PERIODS) {
      await prisma.copyTraderPerformance.create({
        data: { traderId: t.id, period, returnBps: performanceFor(t.history.curve, period) },
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

  const retired = await prisma.copyTrader.updateMany({
    where: {
      id: { startsWith: "seed-" },
      NOT: { id: { in: TRADERS.map((t) => t.id) } },
    },
    data: { isActive: false, isVisible: false, simulationEnabled: false },
  });

  const losers = TRADERS.filter((t) => t.cumulativeRoiBps < 0).length;
  const crazy = TRADERS.filter((t) => t.outcome === "CRAZY_WIN" || t.outcome === "CRAZY_LOSS").length;
  console.log(
    `Copy traders — created: ${created}, refreshed: ${refreshed}, retired: ${retired.count}. ` +
      `Catalog: ${TRADERS.length} total, ${losers} losing (${Math.round((losers / TRADERS.length) * 100)}%), ${crazy} extreme.`,
  );
}

/**
 * Rebuilds only the presentational track record (equity curve, period returns
 * and derived stats) of traders already in the catalog. Investments, ledger
 * entries, withdrawals and performance events are never touched, so no investor
 * balance can change.
 */
export async function refreshCopyTraderHistory(prisma: PrismaClient): Promise<void> {
  let updated = 0;

  for (const t of TRADERS) {
    const existing = await prisma.copyTrader.findUnique({ where: { id: t.id } });
    if (!existing) continue;

    await prisma.copyTrader.update({
      where: { id: t.id },
      data: {
        countryCode: t.countryCode,
        countryName: t.countryName,
        minInvestment: toMicro(t.minInvestment),
        roiBps: t.roiBps,
        cumulativeRoiBps: t.cumulativeRoiBps,
        winRateBps: t.winRateBps,
        maxDrawdownBps: t.maxDrawdownBps,
        winningTrades: t.winningTrades,
        losingTrades: t.losingTrades,
        profitDays: t.profitDays,
        experienceDays: t.experienceDays,
      },
    });

    for (const period of PERIODS) {
      const returnBps = performanceFor(t.history.curve, period);
      await prisma.copyTraderPerformance.upsert({
        where: { traderId_period: { traderId: t.id, period } },
        update: { returnBps },
        create: { traderId: t.id, period, returnBps },
      });
    }

    await prisma.copyTraderChartPoint.deleteMany({ where: { traderId: t.id } });
    await prisma.copyTraderChartPoint.createMany({
      data: chartPointsFor(t).map((p) => ({
        traderId: t.id,
        date: p.date,
        valueBps: p.valueBps,
      })),
      skipDuplicates: true,
    });

    updated++;
  }

  console.log(`Rebuilt the track record of ${updated} copy traders.`);
}

/** Exposed for tooling/verification. */
export function copyCatalogPreview() {
  return TRADERS.map((t) => ({
    name: t.name,
    country: t.countryCode,
    risk: t.riskLevel,
    outcome: t.outcome,
    allTimeBps: t.cumulativeRoiBps,
    monthBps: performanceFor(t.history.curve, "MONTH"),
    maxDrawdownBps: t.maxDrawdownBps,
    downDays: t.history.curve.filter((v, i) => i > 0 && v < t.history.curve[i - 1]).length,
  }));
}
