import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_DURATION_MAX_MINUTES,
  DEFAULT_DURATION_MIN_MINUTES,
  DEFAULT_MAX_OPS_PER_DAY,
  DEFAULT_MIN_OPS_PER_DAY,
  MIN_OPERATION_GAP_MS,
  afterCloseSchedule,
  dailyOpsTarget,
  ensureDayPlan,
  feasibleOpsTarget,
  omitAdminOperationFields,
  operationDurationMs,
  operationOpenIdempotencyKey,
  operationSettlementKey,
  scheduleNextOpen,
  simulatedOpenKey,
  utcDayKey,
  utcDayStart,
  utcNextDayStart,
} from "./operation-schedule";

const traderId = "trader-live-1";
const settings = {
  traderId,
  minOpsPerDay: DEFAULT_MIN_OPS_PER_DAY,
  maxOpsPerDay: DEFAULT_MAX_OPS_PER_DAY,
  durationMinMinutes: DEFAULT_DURATION_MIN_MINUTES,
  durationMaxMinutes: DEFAULT_DURATION_MAX_MINUTES,
};

describe("UTC day plan", () => {
  it("keys and bounds a UTC day independently of local time", () => {
    const now = new Date("2026-08-17T23:30:00.000Z");
    assert.equal(utcDayKey(now), "2026-08-17");
    assert.equal(utcDayStart(now).toISOString(), "2026-08-17T00:00:00.000Z");
    assert.equal(utcNextDayStart(now).toISOString(), "2026-08-18T00:00:00.000Z");
  });

  it("resets the persisted plan at the UTC day boundary", () => {
    const late = new Date("2026-08-17T23:50:00.000Z");
    const nextMorning = new Date("2026-08-18T00:05:00.000Z");
    const yesterday = ensureDayPlan(
      {
        dayKey: "2026-08-16",
        opsToday: 12,
        opsTarget: 14,
        nextOperationAt: late,
      },
      settings,
      late,
    );
    const today = ensureDayPlan(yesterday, settings, nextMorning);
    assert.equal(yesterday.dayKey, "2026-08-17");
    assert.equal(yesterday.opsToday, 0);
    assert.equal(today.dayKey, "2026-08-18");
    assert.equal(today.opsToday, 0);
    assert.ok(today.nextOperationAt);
  });

  it("keeps the same UTC-day target and next open after a restart", () => {
    const now = new Date("2026-08-17T09:15:00.000Z");
    const empty = {
      dayKey: "",
      opsToday: 0,
      opsTarget: 0,
      nextOperationAt: null,
    };
    const first = ensureDayPlan(empty, settings, now);
    const second = ensureDayPlan(first, settings, now);
    assert.equal(first.opsTarget, second.opsTarget);
    assert.equal(
      first.nextOperationAt?.toISOString(),
      second.nextOperationAt?.toISOString(),
    );
    assert.ok(first.opsTarget >= 8 && first.opsTarget <= 20);
  });

  it("draws a stable daily target inside the configured bounds", () => {
    const dayKey = "2026-08-17";
    const first = dailyOpsTarget(traderId, dayKey, 8, 20);
    const second = dailyOpsTarget(traderId, dayKey, 8, 20);
    assert.equal(first, second);
    assert.ok(first >= 8 && first <= 20);

    const values = new Set<number>();
    for (let day = 1; day <= 40; day += 1) {
      const key = `2026-07-${String(day).padStart(2, "0")}`;
      const target = dailyOpsTarget(traderId, key, 8, 20);
      assert.ok(target >= 8 && target <= 20);
      values.add(target);
    }
    assert.ok(values.size > 3);
    assert.notEqual(
      dailyOpsTarget("trader-a", dayKey, 8, 20),
      dailyOpsTarget("trader-b", dayKey, 8, 20),
    );
  });
});

describe("operation duration and spacing", () => {
  it("keeps every duration inside the 3–10 minute range", () => {
    for (let seq = 0; seq < 40; seq += 1) {
      const ms = operationDurationMs(
        traderId,
        "2026-08-17",
        seq,
        DEFAULT_DURATION_MIN_MINUTES,
        DEFAULT_DURATION_MAX_MINUTES,
      );
      assert.ok(ms >= 3 * 60_000);
      assert.ok(ms <= 10 * 60_000);
      assert.equal(ms % 60_000, 0);
    }
  });

  it("does not schedule more operations than the remaining UTC day can hold", () => {
    const late = new Date("2026-08-17T23:50:00.000Z");
    const target = feasibleOpsTarget(20, late, 3);
    assert.ok(target <= 2);
  });

  it("enforces the daily max by resting until the next UTC day", () => {
    const now = new Date("2026-08-17T12:00:00.000Z");
    const plan = afterCloseSchedule(
      {
        dayKey: "2026-08-17",
        opsToday: 19,
        opsTarget: 20,
        nextOperationAt: now,
      },
      settings,
      now,
    );
    assert.equal(plan.opsToday, 20);
    assert.equal(
      plan.nextOperationAt?.toISOString(),
      utcNextDayStart(now).toISOString(),
    );
  });

  it("spaces the next open after a close instead of opening immediately", () => {
    const now = new Date("2026-08-17T08:00:00.000Z");
    const plan = afterCloseSchedule(
      {
        dayKey: "2026-08-17",
        opsToday: 2,
        opsTarget: 12,
        nextOperationAt: now,
      },
      settings,
      now,
    );
    assert.equal(plan.opsToday, 3);
    assert.ok(plan.nextOperationAt);
    assert.ok(plan.nextOperationAt.getTime() >= now.getTime() + MIN_OPERATION_GAP_MS);
    assert.ok(plan.nextOperationAt.getTime() < utcNextDayStart(now).getTime());
  });

  it("keeps remaining operations inside the rest of the UTC day", () => {
    const now = new Date("2026-08-17T10:00:00.000Z");
    const next = scheduleNextOpen({
      traderId,
      dayKey: "2026-08-17",
      seq: 4,
      remainingOps: 8,
      now,
      durationMinMinutes: 3,
      durationMaxMinutes: 10,
    });
    assert.ok(next.getTime() >= now.getTime() + MIN_OPERATION_GAP_MS);
    assert.ok(next.getTime() < utcNextDayStart(now).getTime());
  });
});

describe("idempotency and privacy", () => {
  it("uses one open key per trader so only one live operation can exist", () => {
    assert.equal(simulatedOpenKey(traderId), traderId);
  });

  it("uses stable open and settlement keys", () => {
    assert.equal(
      operationOpenIdempotencyKey(traderId, "2026-08-17", 3),
      "operation:trader-live-1:2026-08-17:3",
    );
    assert.equal(
      operationSettlementKey("op-9"),
      "operation-settlement:op-9",
    );
  });

  it("strips admin-only fields from the public operation DTO", () => {
    const publicDto = omitAdminOperationFields({
      id: "op-1",
      symbol: "BTCUSDT",
      floatingReturnBps: 12,
      closesAt: "2026-08-17T10:04:00.000Z",
      targetReturnBps: 40,
      nextOperationAt: "2026-08-17T11:00:00.000Z",
    });
    assert.equal("closesAt" in publicDto, false);
    assert.equal("targetReturnBps" in publicDto, false);
    assert.equal(publicDto.id, "op-1");
    assert.equal(publicDto.floatingReturnBps, 12);
  });
});
