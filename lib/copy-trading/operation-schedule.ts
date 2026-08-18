import { createHash } from "node:crypto";
import { utcDayKey, utcDayStart, utcNextDayStart } from "./utc-day";

export { utcDayKey, utcDayStart, utcNextDayStart };

export const DEFAULT_MIN_OPS_PER_DAY = 8;
export const DEFAULT_MAX_OPS_PER_DAY = 20;
export const DEFAULT_DURATION_MIN_MINUTES = 3;
export const DEFAULT_DURATION_MAX_MINUTES = 10;
export const MIN_OPS_PER_DAY = 1;
export const MAX_OPS_PER_DAY = 48;
export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 120;
/** Minimum idle gap between a close and the next open. */
export const MIN_OPERATION_GAP_MS = 60_000;

export type DayPlan = {
  dayKey: string;
  opsToday: number;
  opsTarget: number;
  nextOperationAt: Date | null;
};

export type ScheduleSettings = {
  traderId: string;
  minOpsPerDay: number;
  maxOpsPerDay: number;
  durationMinMinutes: number;
  durationMaxMinutes: number;
};

export function clampOpsRange(min: number, max: number): {
  min: number;
  max: number;
} {
  const lo = Math.min(
    MAX_OPS_PER_DAY,
    Math.max(MIN_OPS_PER_DAY, Math.trunc(min)),
  );
  const hi = Math.min(
    MAX_OPS_PER_DAY,
    Math.max(MIN_OPS_PER_DAY, Math.trunc(max)),
  );
  return lo <= hi ? { min: lo, max: hi } : { min: hi, max: lo };
}

export function clampDurationRange(minMinutes: number, maxMinutes: number): {
  minMinutes: number;
  maxMinutes: number;
} {
  const lo = Math.min(
    MAX_DURATION_MINUTES,
    Math.max(MIN_DURATION_MINUTES, Math.trunc(minMinutes)),
  );
  const hi = Math.min(
    MAX_DURATION_MINUTES,
    Math.max(MIN_DURATION_MINUTES, Math.trunc(maxMinutes)),
  );
  return lo <= hi
    ? { minMinutes: lo, maxMinutes: hi }
    : { minMinutes: hi, maxMinutes: lo };
}

export function scheduleDigest(seed: string): Buffer {
  return createHash("sha256").update(seed).digest();
}

export function deterministicRange(
  digest: Buffer,
  offset: number,
  min: number,
  max: number,
): number {
  if (min === max) return min;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + (digest.readUInt32BE(offset % 28) % (hi - lo + 1));
}

export function dailyOpsTarget(
  traderId: string,
  dayKey: string,
  minOps: number,
  maxOps: number,
): number {
  const { min, max } = clampOpsRange(minOps, maxOps);
  return deterministicRange(
    scheduleDigest(`ops-target:${traderId}:${dayKey}`),
    0,
    min,
    max,
  );
}

export function operationDurationMs(
  traderId: string,
  dayKey: string,
  seq: number,
  minMinutes: number,
  maxMinutes: number,
): number {
  const { minMinutes: lo, maxMinutes: hi } = clampDurationRange(
    minMinutes,
    maxMinutes,
  );
  const minutes = deterministicRange(
    scheduleDigest(`duration:${traderId}:${dayKey}:${seq}`),
    4,
    lo,
    hi,
  );
  return minutes * 60_000;
}

export function feasibleOpsTarget(
  drawn: number,
  now: Date,
  durationMinMinutes: number,
): number {
  const remainingMs = Math.max(
    0,
    utcNextDayStart(now).getTime() - now.getTime(),
  );
  const cycleMs =
    Math.max(MIN_DURATION_MINUTES, Math.trunc(durationMinMinutes)) * 60_000 +
    MIN_OPERATION_GAP_MS;
  const maxFeasible = Math.max(0, Math.floor(remainingMs / cycleMs));
  return Math.min(Math.max(0, Math.trunc(drawn)), maxFeasible);
}

export function simulatedOpenKey(traderId: string): string {
  return traderId;
}

export function operationOpenIdempotencyKey(
  traderId: string,
  dayKey: string,
  seq: number,
): string {
  return `operation:${traderId}:${dayKey}:${seq}`;
}

export function operationSettlementKey(operationId: string): string {
  return `operation-settlement:${operationId}`;
}

export function scheduleNextOpen(input: {
  traderId: string;
  dayKey: string;
  seq: number;
  remainingOps: number;
  now: Date;
  durationMinMinutes: number;
  durationMaxMinutes: number;
}): Date {
  const nextDay = utcNextDayStart(input.now);
  if (input.remainingOps <= 0) return nextDay;

  const { minMinutes, maxMinutes } = clampDurationRange(
    input.durationMinMinutes,
    input.durationMaxMinutes,
  );
  const remainingMs = Math.max(0, nextDay.getTime() - input.now.getTime());
  if (remainingMs < minMinutes * 60_000) return nextDay;

  const avgDurationMs = ((minMinutes + maxMinutes) / 2) * 60_000;
  const reserved = input.remainingOps * avgDurationMs;
  let slack = remainingMs - reserved;
  const minSlack = input.remainingOps * MIN_OPERATION_GAP_MS;
  if (slack < minSlack) slack = minSlack;

  const avgSlack = Math.max(
    MIN_OPERATION_GAP_MS,
    Math.floor(slack / input.remainingOps),
  );
  const digest = scheduleDigest(
    `${input.traderId}:${input.dayKey}:gap:${input.seq}`,
  );
  const gap = deterministicRange(
    digest,
    8,
    MIN_OPERATION_GAP_MS,
    Math.max(MIN_OPERATION_GAP_MS, avgSlack * 2),
  );
  const proposed = new Date(input.now.getTime() + gap);
  if (proposed.getTime() >= nextDay.getTime()) return nextDay;
  return proposed;
}

export function ensureDayPlan(
  plan: DayPlan,
  settings: ScheduleSettings,
  now: Date,
): DayPlan {
  const dayKey = utcDayKey(now);
  const { min, max } = clampOpsRange(
    settings.minOpsPerDay,
    settings.maxOpsPerDay,
  );

  if (plan.dayKey === dayKey && plan.opsTarget > 0) {
    const opsToday = Math.max(0, Math.trunc(plan.opsToday));
    const opsTarget = Math.min(max, Math.max(opsToday, Math.min(plan.opsTarget, max)));
    let nextOperationAt = plan.nextOperationAt;
    if (opsToday >= opsTarget) {
      nextOperationAt = utcNextDayStart(now);
    } else if (!nextOperationAt) {
      nextOperationAt = scheduleNextOpen({
        traderId: settings.traderId,
        dayKey,
        seq: opsToday,
        remainingOps: opsTarget - opsToday,
        now,
        durationMinMinutes: settings.durationMinMinutes,
        durationMaxMinutes: settings.durationMaxMinutes,
      });
    }
    return { dayKey, opsToday, opsTarget, nextOperationAt };
  }

  const drawn = dailyOpsTarget(settings.traderId, dayKey, min, max);
  const opsTarget = feasibleOpsTarget(
    drawn,
    now,
    settings.durationMinMinutes,
  );
  const nextOperationAt =
    opsTarget <= 0
      ? utcNextDayStart(now)
      : scheduleNextOpen({
          traderId: settings.traderId,
          dayKey,
          seq: 0,
          remainingOps: opsTarget,
          now,
          durationMinMinutes: settings.durationMinMinutes,
          durationMaxMinutes: settings.durationMaxMinutes,
        });
  return {
    dayKey,
    opsToday: 0,
    opsTarget,
    nextOperationAt,
  };
}

export function afterCloseSchedule(
  plan: DayPlan,
  settings: ScheduleSettings,
  now: Date,
): DayPlan {
  const opsToday = plan.opsToday + 1;
  const remainingOps = plan.opsTarget - opsToday;
  const nextOperationAt = scheduleNextOpen({
    traderId: settings.traderId,
    dayKey: plan.dayKey,
    seq: opsToday,
    remainingOps,
    now,
    durationMinMinutes: settings.durationMinMinutes,
    durationMaxMinutes: settings.durationMaxMinutes,
  });
  return {
    ...plan,
    opsToday,
    nextOperationAt,
  };
}

export function nextWakeAt(input: {
  closesAt?: Date | null;
  nextOperationAt?: Date | null;
  now: Date;
}): Date {
  const candidates = [input.closesAt, input.nextOperationAt].filter(
    (value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()),
  );
  if (candidates.length === 0) return utcNextDayStart(input.now);
  return new Date(Math.min(...candidates.map((value) => value.getTime())));
}

export function omitAdminOperationFields<T extends Record<string, unknown>>(
  dto: T,
): Omit<T, "closesAt" | "targetReturnBps"> {
  const copy = { ...dto };
  delete copy.closesAt;
  delete copy.targetReturnBps;
  return copy;
}
