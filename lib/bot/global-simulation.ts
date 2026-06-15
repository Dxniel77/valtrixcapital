import { PAIRS } from "@/lib/market/pairs";
import {
  dayKeysThrough,
  daySlotBounds,
  launchSlotIndex,
  slotIndexAt,
  slotTimestamp,
  utcDateKey,
} from "@/lib/company-tools/global-metrics";
import { createSeededRng } from "@/lib/company-tools/seeded-rng";
import type {
  BotCadence,
  BotDirection,
  BotNetwork,
  BotOperation,
  RecentChainTx,
} from "@/lib/bot/store";

const BOT_VOLUME_MIN = 200;
const BOT_VOLUME_MAX = 2_800;
const BOT_VOLUME_STEP = 25;
const BOT_PNL_BIAS = 0.44;
const BOT_PNL_SPREAD_BPS = 95;

const FALLBACK_PAIR_PRICES: Record<string, number> = {
  BTCUSDT: 75_757,
  ETHUSDT: 3_450,
  BNBUSDT: 620,
  SOLUSDT: 185,
  XRPUSDT: 0.62,
  DOGEUSDT: 0.18,
  ADAUSDT: 0.75,
  AVAXUSDT: 38,
};

function priceDecimals(pair: string): number {
  if (pair.startsWith("BTC") || pair.startsWith("ETH")) return 2;
  if (pair.includes("DOGE") || pair.includes("XRP") || pair.includes("ADA")) return 4;
  return 2;
}

function roundPairPrice(pair: string, price: number): number {
  const decimals = priceDecimals(pair);
  const factor = 10 ** decimals;
  return Math.round(price * factor) / factor;
}

function sampleVolume(rng: ReturnType<typeof createSeededRng>): number {
  const span = BOT_VOLUME_MAX - BOT_VOLUME_MIN;
  return (
    Math.round((BOT_VOLUME_MIN + rng.next() * span) / BOT_VOLUME_STEP) *
    BOT_VOLUME_STEP
  );
}

function samplePnlBps(rng: ReturnType<typeof createSeededRng>): number {
  return Math.round((rng.next() - BOT_PNL_BIAS) * BOT_PNL_SPREAD_BPS);
}

export function botProfitUsd(op: Pick<BotOperation, "volume" | "pnlBps">): number {
  return Math.max(0, (op.volume * op.pnlBps) / 10_000);
}

function profitForSlot(slotIndex: number): number {
  const rng = createSeededRng(slotIndex * 1_104_879 + 12_345);
  const volume = sampleVolume(rng);
  const pnlBps = samplePnlBps(rng);
  return Math.max(0, (volume * pnlBps) / 10_000);
}

function deriveOperationPrices(
  pair: string,
  direction: BotDirection,
  pnlBps: number,
  pairLastPrice: Record<string, number>,
  marketAnchors: Record<string, number>,
): { entryPrice: number; exitPrice: number } {
  const fallback = FALLBACK_PAIR_PRICES[pair] ?? 1_000;
  const entry = pairLastPrice[pair] ?? marketAnchors[pair] ?? fallback;
  const move = pnlBps / 10_000;
  const rawExit = direction === "UP" ? entry * (1 + move) : entry * (1 - move);
  return {
    entryPrice: roundPairPrice(pair, entry),
    exitPrice: roundPairPrice(pair, rawExit),
  };
}

function syntheticTxHash(slotIndex: number, network: BotNetwork): string {
  const prefix = network === "BSC" ? "bsc" : "pol";
  let hash = `0x${prefix}`;
  let n = slotIndex;
  for (let i = 0; i < 60; i += 1) {
    hash += (n % 16).toString(16);
    n = Math.floor(n / 16) + i * 17;
  }
  return hash.slice(0, 66).padEnd(66, "0");
}

function pickTx(
  slotIndex: number,
  network: BotNetwork,
  pool: RecentChainTx[],
): RecentChainTx {
  if (pool.length > 0) {
    const rng = createSeededRng(slotIndex * 97 + (network === "BSC" ? 3 : 9));
    return pool[rng.int(pool.length)]!;
  }
  return {
    hash: syntheticTxHash(slotIndex, network),
    executedAt: slotTimestamp(slotIndex, 1),
  };
}

export function createDeterministicBotOperation(
  slotIndex: number,
  cadenceMs: number,
  txPool: Record<BotNetwork, RecentChainTx[]>,
  marketAnchors: Record<string, number>,
  pairLastPrice: Record<string, number>,
): BotOperation {
  const rng = createSeededRng(slotIndex * 1_104_879 + 12_345);
  const pair = PAIRS[rng.int(PAIRS.length)]!;
  const direction: BotDirection = rng.next() > 0.48 ? "UP" : "DOWN";
  const volume = sampleVolume(rng);
  const pnlBps = samplePnlBps(rng);
  const network: BotNetwork = rng.next() > 0.55 ? "BSC" : "POLYGON";
  const tx = pickTx(slotIndex, network, txPool[network]);
  const { entryPrice, exitPrice } = deriveOperationPrices(
    pair.binance,
    direction,
    pnlBps,
    pairLastPrice,
    marketAnchors,
  );
  pairLastPrice[pair.binance] = exitPrice;

  return {
    id: `bot_slot_${slotIndex}`,
    pair: pair.binance,
    direction,
    volume,
    pnlBps,
    network,
    fakeTxHash: tx.hash,
    executedAt: slotTimestamp(slotIndex, cadenceMs),
    entryPrice,
    exitPrice,
    profitDay: utcDateKey(slotTimestamp(slotIndex, cadenceMs)),
  };
}

export function buildGlobalBotFeed(
  now: number,
  cadenceMs: number,
  count: number,
  txPool: Record<BotNetwork, RecentChainTx[]>,
  marketAnchors: Record<string, number>,
): BotOperation[] {
  const currentSlot = slotIndexAt(now, cadenceMs);
  const launchSlot = launchSlotIndex(cadenceMs);
  const startSlot = Math.max(launchSlot, currentSlot - count + 1);
  const pairLastPrice: Record<string, number> = { ...marketAnchors };
  const ops: BotOperation[] = [];

  for (let slot = startSlot; slot <= currentSlot; slot += 1) {
    ops.push(
      createDeterministicBotOperation(
        slot,
        cadenceMs,
        txPool,
        marketAnchors,
        pairLastPrice,
      ),
    );
  }

  return ops.reverse();
}

const dailyProfitMemo = new Map<string, number>();

export function globalBotDailyProfit(
  dayKey: string,
  cadenceMs: number,
  now = Date.now(),
): number {
  const todayKey = utcDateKey(now);
  const memoKey = `${dayKey}:${cadenceMs}`;
  if (dayKey < todayKey) {
    const cached = dailyProfitMemo.get(memoKey);
    if (cached != null) return cached;
  }

  const bounds = daySlotBounds(dayKey, cadenceMs);
  if (!bounds) {
    if (dayKey < todayKey) dailyProfitMemo.set(memoKey, 0);
    return 0;
  }

  const launchSlot = launchSlotIndex(cadenceMs);
  const lastSlot =
    dayKey === todayKey
      ? Math.min(bounds.last, slotIndexAt(now, cadenceMs))
      : bounds.last;
  let total = 0;
  for (let slot = Math.max(bounds.first, launchSlot); slot <= lastSlot; slot += 1) {
    total += profitForSlot(slot);
  }

  if (dayKey < todayKey) dailyProfitMemo.set(memoKey, total);
  return total;
}

export function computeGlobalBotProfits(
  now: number,
  cadenceMs: number,
): { today: number; week: number; allTime: number } {
  const todayKey = utcDateKey(now);
  const weekStartKey = utcDateKey(now - 6 * 86_400_000);

  let today = 0;
  let week = 0;
  let allTime = 0;

  for (const dayKey of dayKeysThrough(todayKey)) {
    const amount = globalBotDailyProfit(dayKey, cadenceMs, now);
    allTime += amount;
    if (dayKey >= weekStartKey && dayKey <= todayKey) week += amount;
    if (dayKey === todayKey) today = amount;
  }

  return { today, week, allTime };
}

export function globalBotWinRate(
  operations: Pick<BotOperation, "pnlBps">[],
): number {
  if (operations.length === 0) return 0;
  const wins = operations.filter((o) => o.pnlBps > 0).length;
  return (wins / operations.length) * 100;
}

export const BOT_CADENCE_MS: Record<BotCadence, number> = {
  fast: 6_000,
  normal: 12_000,
  slow: 24_000,
};
