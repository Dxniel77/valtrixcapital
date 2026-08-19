import { deterministicRange } from "./operation-schedule";

export const TARGET_DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_WIN_PROB_BPS = 6000;
export const DEFAULT_LOSS_PROB_BPS = 4000;
export const DEFAULT_TARGET_CYCLE_DAYS = 30;

export type OperationRole = "WINNER" | "NEUTRAL" | "LOSER";

const ROLES: OperationRole[] = ["WINNER", "NEUTRAL", "LOSER"];

export function unitFromDigest(digest: Buffer, offset: number): number {
  return digest.readUInt32BE(offset % 28) / 4_294_967_296;
}

export function alignedProbability(
  role: OperationRole,
  winProbBps = DEFAULT_WIN_PROB_BPS,
  lossProbBps = DEFAULT_LOSS_PROB_BPS,
): number {
  const win = Math.min(0.97, Math.max(0.03, Math.trunc(winProbBps) / 10_000));
  const loss = Math.min(0.97, Math.max(0.03, Math.trunc(lossProbBps) / 10_000));
  if (role === "WINNER") return win;
  if (role === "LOSER") return Math.min(0.97, Math.max(0.03, 1 - loss));
  return 0.5;
}

export function resolveTargetCycleStart(
  startedAt: Date | null | undefined,
  cycleDays: number,
  now: Date,
): Date {
  const days = Math.max(1, Math.trunc(cycleDays) || DEFAULT_TARGET_CYCLE_DAYS);
  if (!startedAt) return now;
  const elapsed = now.getTime() - startedAt.getTime();
  if (elapsed >= days * TARGET_DAY_MS) return now;
  return startedAt;
}

export function targetElapsedDays(startedAt: Date, now: Date): number {
  return Math.max(0.15, (now.getTime() - startedAt.getTime()) / TARGET_DAY_MS);
}

export function expectedTargetBps(
  monthlyTargetBps: number,
  elapsedDays: number,
  cycleDays: number,
  wanderSeed = 0,
): number {
  const days = Math.max(1, Math.trunc(cycleDays) || DEFAULT_TARGET_CYCLE_DAYS);
  const pace = Math.min(1, elapsedDays / days);
  const linear = monthlyTargetBps * pace;
  const envelope = Math.sin(pace * Math.PI);
  const amp = Math.abs(monthlyTargetBps) * 0.34;
  const wander =
    Math.sin(elapsedDays * 1.85 + wanderSeed) * envelope * amp;
  return linear + wander;
}

export function assignOperationRole(input: {
  targetMode: boolean;
  monthlyTargetBps: number;
  progressBps: number;
  elapsedDays: number;
  cycleDays: number;
  digest: Buffer;
}): OperationRole {
  if (!input.targetMode) {
    return ROLES[input.digest[16] % 3] ?? "NEUTRAL";
  }
  const expected = expectedTargetBps(
    input.monthlyTargetBps,
    input.elapsedDays,
    input.cycleDays,
    unitFromDigest(input.digest, 0) * Math.PI * 2,
  );
  const gap = expected - input.progressBps;
  let probWinner =
    input.monthlyTargetBps >= 0
      ? gap > 0
        ? 0.62
        : 0.38
      : gap < 0
        ? 0.38
        : 0.62;
  const pace = Math.min(
    1,
    input.elapsedDays /
      Math.max(1, Math.trunc(input.cycleDays) || DEFAULT_TARGET_CYCLE_DAYS),
  );
  if (pace >= 0.82) {
    probWinner = gap > 0 ? 0.84 : 0.16;
    if (input.monthlyTargetBps < 0) {
      probWinner = gap < 0 ? 0.16 : 0.84;
    }
  }
  probWinner = Math.min(
    0.88,
    Math.max(0.12, probWinner + (unitFromDigest(input.digest, 8) * 0.16 - 0.08)),
  );
  const roll = unitFromDigest(input.digest, 12);
  if (roll < probWinner) return "WINNER";
  if (roll < probWinner + 0.14) return "NEUTRAL";
  return "LOSER";
}

export function pickSignedReturnBps(input: {
  win: boolean;
  minBps: number;
  maxBps: number;
  digest: Buffer;
  offset?: number;
}): number {
  const { lo, hi } = rangeForSign(input.win, input.minBps, input.maxBps);
  return deterministicRange(input.digest, input.offset ?? 8, lo, hi);
}

function rangeForSign(
  win: boolean,
  minBps: number,
  maxBps: number,
): { lo: number; hi: number } {
  if (win) {
    const lo = Math.max(0, minBps);
    const hi = Math.max(lo, maxBps);
    return { lo, hi };
  }
  const hi = Math.min(0, maxBps);
  const lo = Math.min(hi, minBps);
  return { lo, hi };
}

export function targetProgressSnapshot(input: {
  enabled: boolean;
  targetBps: number;
  cycleDays: number;
  startedAt: Date | null;
  progressBps: number;
  now: Date;
}): {
  enabled: boolean;
  targetBps: number;
  cycleDays: number;
  startedAt: string | null;
  elapsedDays: number;
  dayIndex: number;
  progressBps: number;
  expectedBps: number;
} {
  const cycleDays = Math.max(1, Math.trunc(input.cycleDays) || DEFAULT_TARGET_CYCLE_DAYS);
  if (!input.enabled || !input.startedAt) {
    return {
      enabled: input.enabled,
      targetBps: input.targetBps,
      cycleDays,
      startedAt: input.startedAt?.toISOString() ?? null,
      elapsedDays: 0,
      dayIndex: 0,
      progressBps: input.progressBps,
      expectedBps: 0,
    };
  }
  const startedAt = resolveTargetCycleStart(input.startedAt, cycleDays, input.now);
  const elapsedDays = targetElapsedDays(startedAt, input.now);
  return {
    enabled: true,
    targetBps: input.targetBps,
    cycleDays,
    startedAt: startedAt.toISOString(),
    elapsedDays,
    dayIndex: Math.min(cycleDays, Math.max(1, Math.floor(elapsedDays))),
    progressBps: input.progressBps,
    expectedBps: expectedTargetBps(
      input.targetBps,
      elapsedDays,
      cycleDays,
      startedAt.getTime() / 3_600_000,
    ),
  };
}

export function pickLiveReturnBps(input: {
  role: OperationRole;
  winProbBps: number;
  lossProbBps: number;
  minBps: number;
  maxBps: number;
  digest: Buffer;
}): number {
  const aligned =
    unitFromDigest(input.digest, 20) <
    alignedProbability(input.role, input.winProbBps, input.lossProbBps);
  return pickSignedReturnBps({
    win: aligned,
    minBps: input.minBps,
    maxBps: input.maxBps,
    digest: input.digest,
    offset: 8,
  });
}

function clampBps(value: number, minBps: number, maxBps: number): number {
  const lo = Math.min(minBps, maxBps);
  const hi = Math.max(minBps, maxBps);
  return Math.min(hi, Math.max(lo, Math.round(value)));
}

/** Close result for a live op: wanders early, then pulls the cycle toward the exact target. */
export function pickTargetedReturnBps(input: {
  targetMode: boolean;
  monthlyTargetBps: number;
  progressBps: number;
  elapsedDays: number;
  cycleDays: number;
  minBps: number;
  maxBps: number;
  digest: Buffer;
  role: OperationRole;
  winProbBps: number;
  lossProbBps: number;
}): number {
  const raw = pickLiveReturnBps({
    role: input.role,
    winProbBps: input.winProbBps,
    lossProbBps: input.lossProbBps,
    minBps: input.minBps,
    maxBps: input.maxBps,
    digest: input.digest,
  });
  if (!input.targetMode) return raw;

  const days = Math.max(1, Math.trunc(input.cycleDays) || DEFAULT_TARGET_CYCLE_DAYS);
  const pace = Math.min(1, input.elapsedDays / days);
  const remaining = input.monthlyTargetBps - input.progressBps;
  const noiseAmp = Math.max(
    18,
    Math.abs(input.monthlyTargetBps) * (0.24 * (1 - pace) + 0.05),
  );
  const noise = (unitFromDigest(input.digest, 24) * 2 - 1) * noiseAmp;
  if (pace >= 0.82) {
    const pull = remaining * (0.42 + unitFromDigest(input.digest, 4) * 0.32);
    return clampBps(pull + noise * 0.22, input.minBps, input.maxBps);
  }
  const mixed =
    raw * (0.62 + 0.28 * (1 - pace)) + remaining * 0.07 * pace + noise;
  return clampBps(mixed, input.minBps, input.maxBps);
}
