import { scheduleDigest } from "./operation-schedule";

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function smoothstep(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

function periodSeconds(digest: Buffer, index: number, min: number, span: number): number {
  return min + (digest[index] / 255) * span;
}

/**
 * Live mark for an open operation: wanders up and down like a tape,
 * then eases onto `targetReturnBps` as the close approaches.
 */
export function floatingReturnBps(input: {
  operationId: string;
  targetReturnBps: number;
  openedAt: number;
  closesAt: number;
  now: number;
}): number {
  const duration = Math.max(1, input.closesAt - input.openedAt);
  if (input.now >= input.closesAt) return input.targetReturnBps;
  if (input.now <= input.openedAt) return 0;

  const elapsed = clamp((input.now - input.openedAt) / duration, 0, 1);
  const tSec = (input.now - input.openedAt) / 1000;
  const digest = scheduleDigest(`float:${input.operationId}`);
  const phase = (index: number) => (digest[index] / 255) * Math.PI * 2;

  const wFast = Math.sin(
    (tSec / periodSeconds(digest, 3, 5.5, 5)) * Math.PI * 2 + phase(0),
  );
  const wMid = Math.sin(
    (tSec / periodSeconds(digest, 4, 16, 14)) * Math.PI * 2 + phase(1),
  );
  const wSlow = Math.sin(
    (tSec / periodSeconds(digest, 5, 38, 40)) * Math.PI * 2 + phase(2),
  );

  const targetAbs = Math.max(55, Math.abs(input.targetReturnBps));
  const amp = targetAbs * (0.7 + (digest[6] / 255) * 0.55);
  const wander = Math.round(
    amp * (0.18 * wFast + 0.42 * wMid + 0.4 * wSlow),
  );

  const fadeIn = smoothstep(elapsed / 0.07);
  const settle = smoothstep((elapsed - 0.8) / 0.2);
  const mixed = wander * (1 - settle) + input.targetReturnBps * settle;
  return Math.round(mixed * fadeIn);
}
