/**
 * Additive enricher for ALL copy traders (~160).
 *
 * - Never deletes traders, investments, chart points, or existing operations.
 * - Sets performanceFeeBps / maxInvestors when missing or default-only.
 * - Inserts closed multi-coin history ops (BTC/ETH/BNB/SOL/XRP/…) with stable
 *   idempotency keys — safe to re-run.
 * - Updates win/loss/volume stats FROM those closed ops (update only).
 * - Syncs investorsCount from real ACTIVE investments.
 *
 * Run after migrate:
 *   npm run db:copy:enrich
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

const prisma = new PrismaClient();

const MARKETS = [
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

/** Target closed ops per trader so Performance / donut / history have data. */
const TARGET_CLOSED_OPS = 48;

function digest(seed: string): Buffer {
  return createHash("sha256").update(seed).digest();
}

function range(buf: Buffer, offset: number, min: number, max: number): number {
  if (min === max) return min;
  return min + (buf.readUInt32BE(offset % 28) % (max - min + 1));
}

function feeForRisk(risk: string, seed: Buffer): number {
  // 8–15% depending on risk, slight per-trader variation.
  if (risk === "LOW") return range(seed, 0, 800, 1000);
  if (risk === "HIGH") return range(seed, 0, 1200, 1500);
  return range(seed, 0, 900, 1200);
}

function capacityForTrader(seed: Buffer): number {
  // 80–220 slots — capacity only; real copiers still come from investments.
  return range(seed, 4, 8, 22) * 10;
}

async function syncStatsFromOps(traderId: string) {
  const closed = await prisma.copyTraderOperation.findMany({
    where: { traderId, status: "CLOSED" },
    select: { settledReturnBps: true, targetReturnBps: true, leverage: true },
    take: 500,
  });
  if (closed.length === 0) return;

  let wins = 0;
  let losses = 0;
  let volumeMicro = 0n;
  for (const op of closed) {
    const bps = op.settledReturnBps ?? op.targetReturnBps;
    if (bps > 0) wins += 1;
    else if (bps < 0) losses += 1;
    // Notional proxy: ~$500–$2k per op for volume display (micro-USDT).
    volumeMicro += BigInt(500_000_000 + Math.abs(bps) * 10_000 * op.leverage);
  }
  const decided = wins + losses;
  const winRateBps =
    decided === 0 ? 0 : Math.round((wins / decided) * 10_000);

  await prisma.copyTrader.update({
    where: { id: traderId },
    data: {
      winningTrades: wins,
      losingTrades: losses,
      winRateBps,
      tradeVolume: volumeMicro,
    },
  });
}

async function main() {
  // All traders in DB (visible + hidden) — additive only.
  const traders = await prisma.copyTrader.findMany({
    select: {
      id: true,
      name: true,
      riskLevel: true,
      performanceFeeBps: true,
      maxInvestors: true,
      simulationMinBps: true,
      simulationMaxBps: true,
      isVisible: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  console.log(
    `Enriching ${traders.length} traders (additive: multi-coin ops + fee/capacity/stats)…`,
  );

  let opsInserted = 0;
  let tradersTouched = 0;

  for (const trader of traders) {
    tradersTouched += 1;
    const seed = digest(`meta:${trader.id}`);
    const nextFee =
      trader.performanceFeeBps > 0 && trader.performanceFeeBps !== 1000
        ? trader.performanceFeeBps
        : feeForRisk(trader.riskLevel, seed);
    const nextMax =
      trader.maxInvestors > 0 && trader.maxInvestors !== 180
        ? trader.maxInvestors
        : capacityForTrader(seed);

    await prisma.copyTrader.update({
      where: { id: trader.id },
      data: {
        performanceFeeBps: nextFee,
        maxInvestors: nextMax,
      },
    });

    const existingClosed = await prisma.copyTraderOperation.count({
      where: { traderId: trader.id, status: "CLOSED" },
    });
    const toAdd = Math.max(0, TARGET_CLOSED_OPS - existingClosed);
    let inserted = 0;
    const now = Date.now();

    for (let i = 0; i < toAdd; i++) {
      const key = `enrich:history:${trader.id}:${i}`;
      const exists = await prisma.copyTraderOperation.findUnique({
        where: { idempotencyKey: key },
        select: { id: true },
      });
      if (exists) continue;

      const d = digest(key);
      const market = MARKETS[d[0] % MARKETS.length];
      const direction = d[1] % 2 === 0 ? "LONG" : "SHORT";
      const lev =
        trader.riskLevel === "LOW"
          ? range(d, 4, 1, 3)
          : trader.riskLevel === "HIGH"
            ? range(d, 4, 5, 12)
            : range(d, 4, 2, 6);
      const target = range(
        d,
        8,
        trader.simulationMinBps,
        trader.simulationMaxBps,
      );
      const noise = range(d, 12, -180, 180);
      const entry = market.basePrice * (1 + noise / 10_000);
      const daysAgo = range(d, 16, 1, 60);
      const durMin = range(d, 20, 15, 480);
      const closedAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
      const openedAt = new Date(closedAt.getTime() - durMin * 60_000);
      const dirSign = direction === "LONG" ? 1 : -1;
      const exit = entry * (1 + (target / lev / 10_000) * dirSign);

      try {
        await prisma.copyTraderOperation.create({
          data: {
            id: randomUUID(),
            traderId: trader.id,
            symbol: market.symbol,
            direction,
            leverage: lev,
            entryPrice: entry,
            targetReturnBps: target,
            exitPrice: exit,
            settledReturnBps: target,
            status: "CLOSED",
            openKey: null,
            idempotencyKey: key,
            openedAt,
            closesAt: closedAt,
            closedAt,
          },
        });
        inserted += 1;
      } catch (err) {
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          continue;
        }
        throw err;
      }
    }

    opsInserted += inserted;

    // Real investors only for count.
    const active = await prisma.copyInvestment.findMany({
      where: { traderId: trader.id, status: "ACTIVE" },
      distinct: ["userId"],
      select: { userId: true },
    });
    await prisma.copyTrader.update({
      where: { id: trader.id },
      data: { investorsCount: active.length },
    });

    await syncStatsFromOps(trader.id);

    if (inserted > 0 || tradersTouched % 20 === 0) {
      console.log(
        `  [${tradersTouched}/${traders.length}] ${trader.name}: +${inserted} ops (had ${existingClosed} closed)${trader.isVisible ? "" : " [hidden]"}`,
      );
    }
  }

  console.log(
    `Done. Traders touched: ${tradersTouched}. New closed ops: ${opsInserted}. Nothing deleted.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
