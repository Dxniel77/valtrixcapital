import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eligibleForPerformance,
  protectedFromLoss,
} from "./eligibility";
import {
  operationOpenIdempotencyKey,
  operationSettlementKey,
  simulatedOpenKey,
} from "./operation-schedule";
import { applyPerformanceWithFee } from "./sync-engine";

const USDT = 1_000_000n;
const cutoff = new Date("2026-08-17T22:00:00.000Z");

describe("live operation settlement contracts", () => {
  it("keeps one open operation per trader", () => {
    assert.equal(simulatedOpenKey("trader-a"), simulatedOpenKey("trader-a"));
    assert.notEqual(simulatedOpenKey("trader-a"), simulatedOpenKey("trader-b"));
  });

  it("settles each close once via a per-operation key", () => {
    const first = operationSettlementKey("op-1");
    const second = operationSettlementKey("op-1");
    assert.equal(first, second);
    assert.notEqual(first, operationSettlementKey("op-2"));
    assert.notEqual(
      operationOpenIdempotencyKey("trader-a", "2026-08-17", 0),
      operationOpenIdempotencyKey("trader-a", "2026-08-17", 1),
    );
  });

  it("applies copier P&L and a profit-only performance fee", () => {
    const profit = applyPerformanceWithFee(
      [
        {
          id: "copy-1",
          principal: 100n * USDT,
          currentValue: 100n * USDT,
          realizedPnl: 0n,
        },
      ],
      1_000,
      1_000,
    );
    assert.equal(profit.grossTotalDelta, 10n * USDT);
    assert.equal(profit.totalFee, 1n * USDT);
    assert.equal(profit.totalDelta, 9n * USDT);
    assert.equal(profit.investments[0]?.currentValue, 109n * USDT);

    const loss = applyPerformanceWithFee(
      [
        {
          id: "copy-1",
          principal: 100n * USDT,
          currentValue: 100n * USDT,
          realizedPnl: 0n,
        },
      ],
      -500,
      1_000,
    );
    assert.equal(loss.totalFee, 0n);
    assert.equal(loss.totalDelta, -5n * USDT);
    assert.equal(loss.feeLedger.length, 0);
  });

  it("keeps loss grace on the same settlement path", () => {
    const startedAt = new Date("2026-08-16T20:00:00.000Z");
    assert.equal(protectedFromLoss(startedAt, cutoff, 2), true);
    assert.equal(eligibleForPerformance(startedAt, cutoff, -80, 2), false);
    assert.equal(eligibleForPerformance(startedAt, cutoff, 80, 2), true);
  });
});
