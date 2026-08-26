import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { companyCopyEconomicMicro } from "./company-economics";

const USDT = 1_000_000n;

describe("company copy economic P&L", () => {
  it("treats copier gross profit as a company cost, offset by fees kept", () => {
    const feesKept = 18n * USDT;
    const copierGross = 100n * USDT;
    assert.equal(companyCopyEconomicMicro(feesKept, copierGross), -82n * USDT);
  });

  it("treats copier gross loss as a company gain", () => {
    const feesKept = 5n * USDT;
    const copierGross = -100n * USDT;
    assert.equal(companyCopyEconomicMicro(feesKept, copierGross), 105n * USDT);
  });
});
