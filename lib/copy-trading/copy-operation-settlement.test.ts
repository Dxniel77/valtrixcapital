import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eligibleForLiveOperation } from "./eligibility";
import {
  operationOpenIdempotencyKey,
  operationSettlementKey,
  simulatedOpenKey,
} from "./operation-schedule";
import { applyPerformanceWithFee } from "./sync-engine";

const USDT = 1_000_000n;

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

  it("settles any copy that joined before the live close", () => {
    const startedAt = new Date("2026-08-17T23:30:00.000Z");
    const closedAt = new Date("2026-08-17T23:46:00.000Z");
    assert.equal(eligibleForLiveOperation(startedAt, closedAt), true);
  });
});
