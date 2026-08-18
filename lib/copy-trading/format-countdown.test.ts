import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCopyRemaining } from "./format-countdown";

describe("formatCopyRemaining", () => {
  const now = Date.parse("2026-08-18T20:00:00.000Z");

  it("uses minutes and seconds for a 3–10 minute live op", () => {
    const iso = new Date(now + 6 * 60_000 + 12_000).toISOString();
    assert.equal(formatCopyRemaining(iso, now), "6m 12s");
  });

  it("does not look like a clock when remaining is hours", () => {
    const iso = new Date(now + 10 * 3600_000 + 31 * 60_000 + 36_000).toISOString();
    assert.equal(formatCopyRemaining(iso, now), "10h 31m 36s");
  });

  it("marks past timestamps as due", () => {
    const iso = new Date(now - 1000).toISOString();
    assert.equal(formatCopyRemaining(iso, now), "due");
  });
});
