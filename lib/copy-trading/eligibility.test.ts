import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eligibleForPerformance,
  protectedFromLoss,
} from "./eligibility";

const cutoff = new Date("2026-08-14T22:00:00.000Z");

describe("copy performance eligibility", () => {
  it("lets a new copy receive profit during grace", () => {
    const startedAt = new Date("2026-08-14T20:00:00.000Z");
    assert.equal(eligibleForPerformance(startedAt, cutoff, 100, 2), true);
  });

  it("protects a new copy from loss during grace", () => {
    const startedAt = new Date("2026-08-13T20:00:00.000Z");
    assert.equal(protectedFromLoss(startedAt, cutoff, 2), true);
    assert.equal(eligibleForPerformance(startedAt, cutoff, -100, 2), false);
  });

  it("applies losses once the grace window has elapsed", () => {
    const startedAt = new Date("2026-08-12T21:00:00.000Z");
    assert.equal(protectedFromLoss(startedAt, cutoff, 2), false);
    assert.equal(eligibleForPerformance(startedAt, cutoff, -100, 2), true);
  });

  it("still skips every result for copies started after cutoff", () => {
    const startedAt = new Date("2026-08-14T23:00:00.000Z");
    assert.equal(eligibleForPerformance(startedAt, cutoff, 100, 2), false);
    assert.equal(eligibleForPerformance(startedAt, cutoff, -100, 2), false);
  });
});
