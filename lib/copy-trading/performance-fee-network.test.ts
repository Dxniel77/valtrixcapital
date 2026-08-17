import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
  normalizePerformanceFeeNetworkBps,
  splitPerformanceFeeNetwork,
} from "./performance-fee-network";

const USDT = 1_000_000n;

describe("performance fee network split", () => {
  it("pays Daniel's 6-level shares from the fee, not from user profit", () => {
    const fee = 30n * USDT;
    const split = splitPerformanceFeeNetwork(
      fee,
      DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
      6,
    );
    assert.equal(split.payouts[0]?.amount, 9n * USDT);
    assert.equal(split.payouts[1]?.amount, 4500000n);
    assert.equal(split.payouts[2]?.amount, 3n * USDT);
    assert.equal(split.payouts[3]?.amount, 1500000n);
    assert.equal(split.payouts[4]?.amount, 1500000n);
    assert.equal(split.payouts[5]?.amount, 1500000n);
    assert.equal(split.networkTotal, 21n * USDT);
    assert.equal(split.companyKept, 9n * USDT);
  });

  it("pays nothing on a zero or missing fee", () => {
    const split = splitPerformanceFeeNetwork(
      0n,
      DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
      6,
    );
    assert.equal(split.payouts.length, 0);
    assert.equal(split.networkTotal, 0n);
    assert.equal(split.companyKept, 0n);
  });

  it("keeps unpaid levels with the company when the upline is short", () => {
    const fee = 30n * USDT;
    const split = splitPerformanceFeeNetwork(
      fee,
      DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
      1,
    );
    assert.equal(split.payouts.length, 1);
    assert.equal(split.payouts[0]?.level, 1);
    assert.equal(split.networkTotal, 9n * USDT);
    assert.equal(split.companyKept, 21n * USDT);
  });

  it("never lets configured rates exceed 100% of the fee", () => {
    const rates = normalizePerformanceFeeNetworkBps([6000, 6000, 0, 0, 0, 0]);
    assert.ok(rates.reduce((sum, value) => sum + value, 0) <= 10_000);
    const split = splitPerformanceFeeNetwork(100n * USDT, rates, 6);
    assert.ok(split.networkTotal + split.companyKept <= 100n * USDT);
  });
});
