import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PERFORMANCE_FEE_BPS,
  DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
  normalizePerformanceFeeNetworkBps,
  performanceFeeUnfilledRetention,
  splitPerformanceFeeNetwork,
  traderPerformanceFeeBps,
} from "./performance-fee-network";

const USDT = 1_000_000n;

describe("performance fee network split", () => {
  it("defaults a missing trader fee to 30%", () => {
    assert.equal(traderPerformanceFeeBps(undefined), DEFAULT_PERFORMANCE_FEE_BPS);
    assert.equal(traderPerformanceFeeBps(null), 3000);
    assert.equal(traderPerformanceFeeBps(2000), 2000);
  });
  it("uses each trader's Performance Fee as 100% of the network pool", () => {
    const profit = 100n * USDT;
    const traderFeeBps = 2000;
    const fee = (profit * BigInt(traderFeeBps)) / 10_000n;
    assert.equal(fee, 20n * USDT);

    const split = splitPerformanceFeeNetwork(
      fee,
      DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
      6,
    );
    assert.equal(split.payouts[0]?.amount, 6n * USDT);
    assert.equal(split.payouts[1]?.amount, 3n * USDT);
    assert.equal(split.payouts[2]?.amount, 2n * USDT);
    assert.equal(split.payouts[3]?.amount, 1n * USDT);
    assert.equal(split.payouts[4]?.amount, 1n * USDT);
    assert.equal(split.payouts[5]?.amount, 1n * USDT);
    assert.equal(split.networkTotal, 14n * USDT);
    assert.equal(split.companyKept, 6n * USDT);
  });

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

  it("separates empty-upline remainder from the configured company share", () => {
    const fee = 30n * USDT;
    const full = performanceFeeUnfilledRetention(
      fee,
      DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
      [1, 2, 3, 4, 5, 6],
    );
    assert.equal(full.expectedNetwork, 21n * USDT);
    assert.equal(full.unfilledRetained, 0n);
    assert.equal(full.companyShare, 9n * USDT);

    const short = performanceFeeUnfilledRetention(
      fee,
      DEFAULT_PERFORMANCE_FEE_NETWORK_BPS,
      [1],
    );
    assert.equal(short.unfilledRetained, 12n * USDT);
    assert.equal(short.companyShare, 9n * USDT);
    assert.equal(short.unfilledRetained + short.companyShare, 21n * USDT);
  });
});
