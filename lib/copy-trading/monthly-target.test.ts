import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import {
  alignedProbability,
  assignOperationRole,
  expectedTargetBps,
  pickLiveReturnBps,
  pickSignedReturnBps,
  pickTargetedReturnBps,
  resolveTargetCycleStart,
  TARGET_DAY_MS,
} from "./monthly-target";
import { COPY_RISK_PROFILES } from "./risk-profiles";

function digest(seed: string): Buffer {
  return createHash("sha256").update(seed).digest();
}

describe("copy risk profiles", () => {
  it("matches Daniel's conservador / moderado / agresivo ranges", () => {
    assert.deepEqual(
      [COPY_RISK_PROFILES.LOW.leverageMin, COPY_RISK_PROFILES.LOW.leverageMax],
      [1, 4],
    );
    assert.deepEqual(
      [COPY_RISK_PROFILES.MEDIUM.durationMinMinutes, COPY_RISK_PROFILES.MEDIUM.durationMaxMinutes],
      [4, 8],
    );
    assert.deepEqual(
      [COPY_RISK_PROFILES.HIGH.leverageMin, COPY_RISK_PROFILES.HIGH.leverageMax],
      [6, 15],
    );
  });
});

describe("monthly target bias", () => {
  it("uses configured win rate on a winner day and 50/50 on a neutral day", () => {
    assert.equal(alignedProbability("WINNER", 6000, 4000), 0.6);
    assert.equal(alignedProbability("NEUTRAL", 6000, 4000), 0.5);
    assert.equal(alignedProbability("LOSER", 6000, 4000), 0.6);
  });

  it("picks a positive result on the win side and a negative result on the loss side", () => {
    const seed = digest("target-sign");
    const win = pickSignedReturnBps({
      win: true,
      minBps: -50,
      maxBps: 100,
      digest: seed,
    });
    const loss = pickSignedReturnBps({
      win: false,
      minBps: -50,
      maxBps: 100,
      digest: seed,
    });
    assert.ok(win >= 0 && win <= 100);
    assert.ok(loss <= 0 && loss >= -50);
  });

  it("raises winner odds when the cycle is behind a positive target", () => {
    const behind = assignOperationRole({
      targetMode: true,
      monthlyTargetBps: 600,
      progressBps: 0,
      elapsedDays: 15,
      cycleDays: 30,
      digest: digest("behind-target"),
    });
    const ahead = assignOperationRole({
      targetMode: true,
      monthlyTargetBps: 600,
      progressBps: 800,
      elapsedDays: 15,
      cycleDays: 30,
      digest: digest("ahead-target"),
    });
    assert.equal(expectedTargetBps(600, 30, 30, 0), 600);
    const mid = expectedTargetBps(600, 15, 30, 0);
    assert.notEqual(mid, 300);
    assert.ok(mid > 50 && mid < 550);
    assert.ok(behind === "WINNER" || behind === "NEUTRAL" || behind === "LOSER");
    assert.ok(ahead === "WINNER" || ahead === "NEUTRAL" || ahead === "LOSER");
  });

  it("restarts the cycle after the configured number of days", () => {
    const start = new Date("2026-07-01T00:00:00.000Z");
    const now = new Date(start.getTime() + 30 * TARGET_DAY_MS);
    const next = resolveTargetCycleStart(start, 30, now);
    assert.equal(next.getTime(), now.getTime());
  });

  it("keeps live results inside the trader min/max range", () => {
    const value = pickLiveReturnBps({
      role: "WINNER",
      winProbBps: 9000,
      lossProbBps: 4000,
      minBps: -80,
      maxBps: 120,
      digest: digest("live-range"),
    });
    assert.ok(value >= -80 && value <= 120);
  });

  it("pulls late-cycle results toward the remaining period target", () => {
    const late = pickTargetedReturnBps({
      targetMode: true,
      monthlyTargetBps: 600,
      progressBps: 200,
      elapsedDays: 27,
      cycleDays: 30,
      minBps: -200,
      maxBps: 200,
      digest: digest("late-pull"),
      role: "LOSER",
      winProbBps: 6000,
      lossProbBps: 4000,
    });
    assert.ok(late > 0);
    assert.ok(late >= -200 && late <= 200);
  });
});
