import { PAIRS } from "@/lib/market/pairs";
import { dailyVolumeMultiplier } from "@/lib/liquidation-engine/fees";
import {
  dayKeysThrough,
  daySlotBounds,
  launchSlotIndex,
  slotIndexAt,
  slotTimestamp,
  utcDateKey,
} from "@/lib/company-tools/global-metrics";
import { createSeededRng } from "@/lib/company-tools/seeded-rng";
import { allowSyntheticChainTx } from "@/lib/runtime-mode";
import type {
  LiquidationCadence,
  LiquidationChainTx,
  LiquidationEvent,
  LiquidationNetwork,
} from "@/lib/liquidation-engine/types";

function deterministicSettlementFee(amountUsdt: number, slotIndex: number, dayKey: string): number {
  const rng = createSeededRng(slotIndex * 55_927 + 7_001);
  const feeBps = 4 + rng.next() * 10;
  const raw = (amountUsdt * feeBps) / 10_000;
  const clamped = Math.min(Math.max(raw, 0.002), 3.5);
  const scaled = clamped * dailyVolumeMultiplier(dayKey);
  return Math.round(scaled * 1000) / 1000;
}

function syntheticTx(
  slotIndex: number,
  network: LiquidationNetwork,
): LiquidationChainTx {
  const rng = createSeededRng(slotIndex * 33_119 + (network === "BSC" ? 11 : 19));
  const amountUsdt =
    Math.round((40 + rng.next() * 260) * 100) / 100;
  let hash = network === "BSC" ? "0xbsc" : "0xpol";
  let n = slotIndex;
  for (let i = 0; i < 60; i += 1) {
    hash += (n % 16).toString(16);
    n = Math.floor(n / 16) + i * 13;
  }
  return {
    hash: hash.slice(0, 66).padEnd(66, "0"),
    executedAt: slotTimestamp(slotIndex, 1),
    amountUsdt,
    network,
  };
}

function pickTx(slotIndex: number, pool: LiquidationChainTx[]): LiquidationChainTx | null {
  if (pool.length > 0) {
    const rng = createSeededRng(slotIndex * 71 + 3);
    return pool[rng.int(pool.length)]!;
  }
  if (!allowSyntheticChainTx()) return null;
  const network: LiquidationNetwork = slotIndex % 2 === 0 ? "BSC" : "POLYGON";
  return syntheticTx(slotIndex, network);
}

function pickPair(slotIndex: number, tx: LiquidationChainTx): string {
  const idx =
    Math.abs(tx.hash.charCodeAt(2) + tx.hash.charCodeAt(5) + slotIndex) %
    PAIRS.length;
  return PAIRS[idx]?.binance ?? "BTCUSDT";
}

export function createDeterministicLiquidationEvent(
  slotIndex: number,
  cadenceMs: number,
  txPool: LiquidationChainTx[],
): LiquidationEvent | null {
  const tx = pickTx(slotIndex, txPool);
  if (!tx) return null;
  const executedAt = slotTimestamp(slotIndex, cadenceMs);
  const feeDay = utcDateKey(executedAt);
  const feeUsd = deterministicSettlementFee(tx.amountUsdt, slotIndex, feeDay);

  return {
    id: `liq_slot_${slotIndex}`,
    pair: pickPair(slotIndex, tx),
    network: tx.network,
    txHash: tx.hash,
    amountUsdt: tx.amountUsdt,
    feeUsd,
    executedAt,
    feeDay,
  };
}

export function buildGlobalLiquidationFeed(
  now: number,
  cadenceMs: number,
  count: number,
  txPool: LiquidationChainTx[],
): LiquidationEvent[] {
  const currentSlot = slotIndexAt(now, cadenceMs);
  const launchSlot = launchSlotIndex(cadenceMs);
  const startSlot = Math.max(launchSlot, currentSlot - count + 1);
  const events: LiquidationEvent[] = [];

  for (let slot = startSlot; slot <= currentSlot; slot += 1) {
    const ev = createDeterministicLiquidationEvent(slot, cadenceMs, txPool);
    if (ev) events.push(ev);
  }

  return events.reverse();
}

function feeForSlot(slotIndex: number, cadenceMs: number): number {
  const txPool: LiquidationChainTx[] = [];
  const ev = createDeterministicLiquidationEvent(slotIndex, cadenceMs, txPool);
  return ev?.feeUsd ?? 0;
}

const dailyFeeMemo = new Map<string, number>();
const dailyTxMemo = new Map<string, number>();

export function globalLiquidationDailyStats(
  dayKey: string,
  cadenceMs: number,
  now = Date.now(),
): { fees: number; txs: number } {
  const todayKey = utcDateKey(now);
  const memoKey = `${dayKey}:${cadenceMs}`;
  if (dayKey < todayKey && dailyFeeMemo.has(memoKey) && dailyTxMemo.has(memoKey)) {
    return { fees: dailyFeeMemo.get(memoKey)!, txs: dailyTxMemo.get(memoKey)! };
  }

  const bounds = daySlotBounds(dayKey, cadenceMs);
  if (!bounds) {
    if (dayKey < todayKey) {
      dailyFeeMemo.set(memoKey, 0);
      dailyTxMemo.set(memoKey, 0);
    }
    return { fees: 0, txs: 0 };
  }

  const launchSlot = launchSlotIndex(cadenceMs);
  const lastSlot =
    dayKey === todayKey
      ? Math.min(bounds.last, slotIndexAt(now, cadenceMs))
      : bounds.last;
  let fees = 0;
  let txs = 0;
  for (let slot = Math.max(bounds.first, launchSlot); slot <= lastSlot; slot += 1) {
    fees += feeForSlot(slot, cadenceMs);
    txs += 1;
  }

  if (dayKey < todayKey) {
    dailyFeeMemo.set(memoKey, fees);
    dailyTxMemo.set(memoKey, txs);
  }
  return { fees, txs };
}

export function computeGlobalLiquidationProfits(
  now: number,
  cadenceMs: number,
): { today: number; week: number; allTime: number; processedToday: number } {
  const todayKey = utcDateKey(now);
  const weekStartKey = utcDateKey(now - 6 * 86_400_000);

  let today = 0;
  let week = 0;
  let allTime = 0;
  let processedToday = 0;

  for (const dayKey of dayKeysThrough(todayKey)) {
    const { fees, txs } = globalLiquidationDailyStats(dayKey, cadenceMs, now);
    allTime += fees;
    if (dayKey >= weekStartKey && dayKey <= todayKey) week += fees;
    if (dayKey === todayKey) {
      today = fees;
      processedToday = txs;
    }
  }

  return { today, week, allTime, processedToday };
}

export function globalLiquidationMicroAccrual(now: number, cadenceMs: number): number {
  const todayKey = utcDateKey(now);
  const bounds = daySlotBounds(todayKey, cadenceMs);
  if (!bounds) return 0;

  const currentSlot = slotIndexAt(now, cadenceMs);
  const launchSlot = launchSlotIndex(cadenceMs);
  if (currentSlot < launchSlot) return 0;

  const progress = (now % cadenceMs) / cadenceMs;
  const nextSlot = currentSlot + 1;
  const nextFee = feeForSlot(nextSlot, cadenceMs);
  return nextFee * progress * 0.35;
}

export const LIQUIDATION_CADENCE_MS: Record<LiquidationCadence, number> = {
  fast: 2_000,
  normal: 3_500,
  slow: 6_000,
};
