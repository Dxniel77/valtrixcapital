import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_OPEN_FEE_BPS,
  platformOpenFeeMicro,
} from "./platform-open-fee";

const USDT = 1_000_000n;

describe("platform open fee", () => {
  it("charges 0.05% of notional capital × leverage", () => {
    const capital = 100n * USDT;
    const fee = platformOpenFeeMicro(capital, 10, DEFAULT_OPEN_FEE_BPS);
    assert.equal(fee, 500_000n);
  });

  it("is zero when the open fee is disabled or capital is empty", () => {
    assert.equal(platformOpenFeeMicro(100n * USDT, 10, 0), 0n);
    assert.equal(platformOpenFeeMicro(0n, 10, 5), 0n);
  });
});
