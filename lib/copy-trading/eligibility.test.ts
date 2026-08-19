import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eligibleForLiveOperation } from "./eligibility";

describe("copy close eligibility", () => {
  it("includes a copy that joined before the close", () => {
    const startedAt = new Date("2026-08-19T17:00:00.000Z");
    const closedAt = new Date("2026-08-19T17:16:00.000Z");
    assert.equal(eligibleForLiveOperation(startedAt, closedAt), true);
  });

  it("includes a copy that joined while the trade was still open", () => {
    const startedAt = new Date("2026-08-19T17:12:00.000Z");
    const closedAt = new Date("2026-08-19T17:16:00.000Z");
    assert.equal(eligibleForLiveOperation(startedAt, closedAt), true);
  });

  it("skips a copy that joined after the trade closed", () => {
    const startedAt = new Date("2026-08-19T17:20:00.000Z");
    const closedAt = new Date("2026-08-19T17:16:00.000Z");
    assert.equal(eligibleForLiveOperation(startedAt, closedAt), false);
  });
});
