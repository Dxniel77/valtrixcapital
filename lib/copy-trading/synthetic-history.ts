import { scheduleDigest } from "./operation-schedule";
import { pickLiveReturnBps, type OperationRole } from "./monthly-target";
import {
  COPY_MARKETS,
  pickMarket,
  type CopyMarket,
} from "./markets";

export type HistoryBias = "neutral" | "positive" | "negative";

export const MIN_HISTORY_MONTHS = 1;
export const MAX_HISTORY_MONTHS = 12;
export const MAX_SYNTHETIC_HISTORY_OPS = 1_800;
export const MAX_MANUAL_DELAY_MINUTES = 24 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SyntheticHistoryOp = {
  symbol: string;
  direction: "LONG" | "SHORT";
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  returnBps: number;
  openedAt: Date;
  closedAt: Date;
  idempotencyKey: string;
};

export type SyntheticHistoryInput = {
  traderId: string;
  months: number;
  bias: HistoryBias;
  now: Date;
  minOpsPerDay: number;
  maxOpsPerDay: number;
  durationMinMinutes: number;
  durationMaxMinutes: number;
  minReturnBps: number;
  maxReturnBps: number;
  winProbBps: number;
  lossProbBps: number;
  leverageMin: number;
  leverageMax: number;
  markets: CopyMarket[];
};

export function isHistoryBias(value: string): value is HistoryBias {
  return value === "neutral" || value === "positive" || value === "negative";
}

export function clampHistoryMonths(months: number): number {
  return Math.min(
    MAX_HISTORY_MONTHS,
    Math.max(MIN_HISTORY_MONTHS, Math.trunc(months)),
  );
}

export function exitPriceFromReturn(input: {
  entryPrice: number;
  leverage: number;
  direction: "LONG" | "SHORT";
  returnBps: number;
}): number {
  const directionSign = input.direction === "LONG" ? 1 : -1;
  const priceMove =
    (input.returnBps / Math.max(1, input.leverage) / 10_000) * directionSign;
  return input.entryPrice * (1 + priceMove);
}

function unit(digest: Buffer, offset: number): number {
  return digest.readUInt32BE(offset % 28) / 4_294_967_296;
}

function rangeInt(digest: Buffer, offset: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi <= lo) return lo;
  return lo + Math.floor(unit(digest, offset) * (hi - lo + 1));
}

function biasRole(bias: HistoryBias, digest: Buffer): OperationRole {
  const roll = unit(digest, 4);
  if (bias === "positive") return roll < 0.85 ? "WINNER" : "NEUTRAL";
  if (bias === "negative") return roll < 0.85 ? "LOSER" : "NEUTRAL";
  if (roll < 1 / 3) return "WINNER";
  if (roll < 2 / 3) return "NEUTRAL";
  return "LOSER";
}

export function buildSyntheticHistoryOps(
  input: SyntheticHistoryInput,
): SyntheticHistoryOp[] {
  const months = clampHistoryMonths(input.months);
  const days = Math.max(1, Math.round(months * 30));
  const minOps = Math.max(1, Math.trunc(input.minOpsPerDay));
  const maxOps = Math.max(minOps, Math.trunc(input.maxOpsPerDay));
  const durationMin = Math.max(1, Math.trunc(input.durationMinMinutes));
  const durationMax = Math.max(durationMin, Math.trunc(input.durationMaxMinutes));
  const markets = input.markets.length > 0 ? input.markets : COPY_MARKETS;
  const ops: SyntheticHistoryOp[] = [];
  const nowMs = input.now.getTime();

  for (let day = days; day >= 1; day -= 1) {
    if (ops.length >= MAX_SYNTHETIC_HISTORY_OPS) break;
    const dayDigest = scheduleDigest(`${input.traderId}:hist-day:${day}:${months}`);
    const opsThatDay = rangeInt(dayDigest, 8, minOps, maxOps);
    const dayStart = nowMs - day * DAY_MS;
    for (let i = 0; i < opsThatDay; i += 1) {
      if (ops.length >= MAX_SYNTHETIC_HISTORY_OPS) break;
      const key = `${input.traderId}:hist:${day}:${i}:${months}:${input.bias}`;
      const digest = scheduleDigest(key);
      const market = pickMarket(digest, markets);
      const direction = digest[2] % 2 === 0 ? "LONG" : "SHORT";
      const leverage = rangeInt(
        digest,
        12,
        input.leverageMin,
        input.leverageMax,
      );
      const durationMs =
        rangeInt(digest, 16, durationMin, durationMax) * 60_000;
      const offsetInDay = Math.floor(
        unit(digest, 24) * Math.max(1_000, DAY_MS - durationMs - 1_000),
      );
      const openedAt = new Date(dayStart + offsetInDay);
      const closedAt = new Date(openedAt.getTime() + durationMs);
      const returnBps = pickLiveReturnBps({
        role: biasRole(input.bias, digest),
        winProbBps: input.winProbBps,
        lossProbBps: input.lossProbBps,
        minBps: input.minReturnBps,
        maxBps: input.maxReturnBps,
        digest,
      });
      const entryPrice =
        market.basePrice * (1 + (unit(digest, 6) * 0.06 - 0.03));
      ops.push({
        symbol: market.symbol,
        direction,
        leverage,
        entryPrice,
        exitPrice: exitPriceFromReturn({
          entryPrice,
          leverage,
          direction,
          returnBps,
        }),
        returnBps,
        openedAt,
        closedAt,
        idempotencyKey: `synth:${key}`,
      });
    }
  }

  ops.sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());
  return ops;
}

export function buildManualHistoryOp(input: {
  traderId: string;
  returnBps: number;
  now: Date;
  durationMinMinutes: number;
  durationMaxMinutes: number;
  leverageMin: number;
  leverageMax: number;
  markets: CopyMarket[];
  nonce?: string;
}): SyntheticHistoryOp {
  const key = `${input.traderId}:manual:${input.now.toISOString()}:${input.returnBps}:${input.nonce ?? "now"}`;
  const digest = scheduleDigest(key);
  const markets = input.markets.length > 0 ? input.markets : COPY_MARKETS;
  const market = pickMarket(digest, markets);
  const direction = digest[2] % 2 === 0 ? "LONG" : "SHORT";
  const leverage = rangeInt(digest, 12, input.leverageMin, input.leverageMax);
  const durationMin = Math.max(1, Math.trunc(input.durationMinMinutes));
  const durationMax = Math.max(durationMin, Math.trunc(input.durationMaxMinutes));
  const durationMs = rangeInt(digest, 16, durationMin, durationMax) * 60_000;
  const closedAt = input.now;
  const openedAt = new Date(closedAt.getTime() - durationMs);
  const entryPrice = market.basePrice * (1 + (unit(digest, 6) * 0.02 - 0.01));
  return {
    symbol: market.symbol,
    direction,
    leverage,
    entryPrice,
    exitPrice: exitPriceFromReturn({
      entryPrice,
      leverage,
      direction,
      returnBps: input.returnBps,
    }),
    returnBps: input.returnBps,
    openedAt,
    closedAt,
    idempotencyKey: `manual:${key}`,
  };
}
