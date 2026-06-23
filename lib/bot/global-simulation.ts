import { PAIRS } from "@/lib/market/pairs";
import {
  dayKeysThrough,
  daySlotBounds,
  launchSlotIndex,
  slotIndexAt,
  slotTimestamp,
  utcDateKey,
} from "@/lib/company-tools/global-metrics";
import { botDailyRevenue } from "@/lib/company-tools/engine-daily-budget";
import { createSeededRng } from "@/lib/company-tools/seeded-rng";
import { allowSyntheticChainTx } from "@/lib/runtime-mode";
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

/** Signed per-trade P/L in USD for the live feed (not scaled). */
export function botTradePnlUsd(
  op: Pick<BotOperation, "volume" | "pnlBps">,
): number {
  return Math.round(((op.volume * op.pnlBps) / 10_000) * 100) / 100;
}

/** Scaled positive profit credited to company aggregate totals only. */
export function botProfitUsd(op: Pick<BotOperation, "volume" | "pnlBps">): number {
  return Math.max(0, botTradePnlUsd(op));
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
): RecentChainTx | null {
  if (pool.length > 0) {
    const rng = createSeededRng(slotIndex * 97 + (network === "BSC" ? 3 : 9));
    return pool[rng.int(pool.length)]!;
  }
  if (!allowSyntheticChainTx()) return null;
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
): BotOperation | null {
  const rng = createSeededRng(slotIndex * 1_104_879 + 12_345);
  const pair = PAIRS[rng.int(PAIRS.length)]!;
  const direction: BotDirection = rng.next() > 0.48 ? "UP" : "DOWN";
  const volume = sampleVolume(rng);
  const pnlBps = samplePnlBps(rng);
  const network: BotNetwork = rng.next() > 0.55 ? "BSC" : "POLYGON";
  const altNetwork: BotNetwork = network === "BSC" ? "POLYGON" : "BSC";
  const picked =
    (() => {
      const tx = pickTx(slotIndex, network, txPool[network]);
      if (tx) return { tx, network };
      const altTx = pickTx(slotIndex, altNetwork, txPool[altNetwork]);
      if (altTx) return { tx: altTx, network: altNetwork };
      return null;
    })();
  if (!picked) return null;
  const { tx, network: opNetwork } = picked;

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
    network: opNetwork,
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
    const op = createDeterministicBotOperation(
      slot,
      cadenceMs,
      txPool,
      marketAnchors,
      pairLastPrice,
    );
    if (op) ops.push(op);
  }

  return ops.reverse();
}

const dailyProfitMemo = new Map<string, number>();

export function globalBotDailyProfit(
  dayKey: string,
  _cadenceMs: number,
  now = Date.now(),
): number {
  const todayKey = utcDateKey(now);
  const memoKey = `${dayKey}:budget`;
  if (dayKey < todayKey) {
    const cached = dailyProfitMemo.get(memoKey);
    if (cached != null) return cached;
  }

  const amount = botDailyRevenue(dayKey, now);
  if (dayKey < todayKey) dailyProfitMemo.set(memoKey, amount);
  return amount;
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
