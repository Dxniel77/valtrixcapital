import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { floatingReturnBps } from "./floating-path";

const openedAt = Date.parse("2026-08-18T12:00:00.000Z");
const closesAt = openedAt + 6 * 60_000;

function at(elapsedMs: number, target = 80): number {
  return floatingReturnBps({
    operationId: "op-float-1",
    targetReturnBps: target,
    openedAt,
    closesAt,
    now: openedAt + elapsedMs,
  });
}

describe("floatingReturnBps", () => {
  it("starts near zero and settles on the target at close", () => {
    assert.equal(at(0), 0);
    assert.equal(at(6 * 60_000), 80);
    assert.equal(at(7 * 60_000), 80);
  });

  it("reverses direction instead of only climbing toward the target", () => {
    const samples: number[] = [];
    for (let ms = 8_000; ms < 5 * 60_000; ms += 3_000) {
      samples.push(at(ms, 90));
    }
    let reversals = 0;
    for (let i = 2; i < samples.length; i += 1) {
      const prev = samples[i - 1]! - samples[i - 2]!;
      const next = samples[i]! - samples[i - 1]!;
      if (prev === 0 || next === 0) continue;
      if (Math.sign(prev) !== Math.sign(next)) reversals += 1;
    }
    assert.ok(reversals >= 3, `expected several reversals, got ${reversals}`);
  });

  it("can print the opposite sign of the final target in the middle", () => {
    const target = 120;
    let opposite = false;
    for (let ms = 20_000; ms < 4 * 60_000; ms += 2_000) {
      if (at(ms, target) * target < 0) opposite = true;
    }
    assert.equal(opposite, true);
  });
});
