import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COPY_MARKETS, normalizeActiveSymbols } from "./markets";
import {
  buildManualHistoryOp,
  buildSyntheticHistoryOps,
  clampHistoryMonths,
  exitPriceFromReturn,
} from "./synthetic-history";

const base = {
  traderId: "trader-a",
  now: new Date("2026-08-17T12:00:00.000Z"),
  minOpsPerDay: 2,
  maxOpsPerDay: 3,
  durationMinMinutes: 3,
  durationMaxMinutes: 10,
  minReturnBps: -400,
  maxReturnBps: 600,
  winProbBps: 6000,
  lossProbBps: 4000,
  leverageMin: 3,
  leverageMax: 8,
  markets: COPY_MARKETS.slice(0, 3),
};

describe("copy markets", () => {
  it("keeps only known symbols and falls back to the full set", () => {
    assert.deepEqual(normalizeActiveSymbols(["btcusdt", "FAKE", "ETHUSDT", "BTCUSDT"]), [
      "BTCUSDT",
      "ETHUSDT",
    ]);
    assert.equal(normalizeActiveSymbols([]).length, COPY_MARKETS.length);
  });
});

describe("synthetic history", () => {
  it("clamps months to 1–12", () => {
    assert.equal(clampHistoryMonths(0), 1);
    assert.equal(clampHistoryMonths(3.9), 3);
    assert.equal(clampHistoryMonths(40), 12);
  });

  it("builds past closed ops without touching capital math", () => {
    const ops = buildSyntheticHistoryOps({ ...base, months: 1, bias: "neutral" });
    assert.ok(ops.length >= 30 * 2);
    assert.ok(ops.every((op) => op.closedAt.getTime() < base.now.getTime()));
    assert.ok(ops.every((op) => op.openedAt.getTime() < op.closedAt.getTime()));
    assert.equal(new Set(ops.map((op) => op.idempotencyKey)).size, ops.length);
  });

  it("biases most results green or red", () => {
    const green = buildSyntheticHistoryOps({ ...base, months: 1, bias: "positive" });
    const red = buildSyntheticHistoryOps({ ...base, months: 1, bias: "negative" });
    const greenShare =
      green.filter((op) => op.returnBps > 0).length / Math.max(1, green.length);
    const redGreenShare =
      red.filter((op) => op.returnBps > 0).length / Math.max(1, red.length);
    assert.ok(greenShare > 0.5);
    assert.ok(redGreenShare < greenShare);
  });

  it("keeps a manual result at the requested %", () => {
    const op = buildManualHistoryOp({
      traderId: "trader-a",
      returnBps: -250,
      now: base.now,
      durationMinMinutes: 3,
      durationMaxMinutes: 10,
      leverageMin: 3,
      leverageMax: 8,
      markets: COPY_MARKETS,
    });
    assert.equal(op.returnBps, -250);
    assert.equal(op.closedAt.toISOString(), base.now.toISOString());
    assert.ok(Math.abs(op.exitPrice - exitPriceFromReturn(op)) < 1e-8);
  });
});
