import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPerformanceWithFee } from "./sync-engine";

const USDT = 1_000_000n;

function investment(currentValue = 100n * USDT) {
  return {
    id: "copy-1",
    principal: 100n * USDT,
    currentValue,
    realizedPnl: 0n,
  };
}

describe("applyPerformanceWithFee", () => {
  it("deducts the configured fee from positive profit", () => {
    const result = applyPerformanceWithFee([investment()], 1_000, 2_000);

    assert.equal(result.grossTotalDelta, 10n * USDT);
    assert.equal(result.totalFee, 2n * USDT);
    assert.equal(result.totalDelta, 8n * USDT);
    assert.equal(result.investments[0]?.currentValue, 108n * USDT);
    assert.equal(result.investments[0]?.realizedPnl, 8n * USDT);
    assert.equal(result.pnlLedger[0]?.amount, 10n * USDT);
    assert.equal(result.feeLedger[0]?.amount, -2n * USDT);
    assert.equal(result.feeLedger[0]?.balanceAfter, 108n * USDT);
  });

  it("never charges a fee on a loss", () => {
    const result = applyPerformanceWithFee([investment()], -1_000, 2_000);

    assert.equal(result.grossTotalDelta, -10n * USDT);
    assert.equal(result.totalFee, 0n);
    assert.equal(result.totalDelta, -10n * USDT);
    assert.equal(result.investments[0]?.currentValue, 90n * USDT);
    assert.equal(result.feeLedger.length, 0);
  });

  it("charges the 30% standard fee on profit", () => {
    const result = applyPerformanceWithFee([investment()], 1_000, 3_000);

    assert.equal(result.grossTotalDelta, 10n * USDT);
    assert.equal(result.totalFee, 3n * USDT);
    assert.equal(result.totalDelta, 7n * USDT);
    assert.equal(result.investments[0]?.currentValue, 107n * USDT);
  });

  it("charges no fee when the trader fee is zero", () => {
    const result = applyPerformanceWithFee([investment()], 500, 0);

    assert.equal(result.grossTotalDelta, 5n * USDT);
    assert.equal(result.totalFee, 0n);
    assert.equal(result.totalDelta, 5n * USDT);
    assert.equal(result.investments[0]?.currentValue, 105n * USDT);
  });
});
