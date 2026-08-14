import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftReturnBps } from "./admin-draft";

describe("admin performance draft", () => {
  it("only drafts negative values in Harvest when the range allows losses", () => {
    assert.equal(draftReturnBps(-50, 100, "HARVEST", () => 0), -50);
    assert.equal(draftReturnBps(-50, 100, "HARVEST", () => 0.999), -1);
  });

  it("only drafts positive values in Growth when the range allows gains", () => {
    assert.equal(draftReturnBps(-50, 100, "GROWTH", () => 0), 1);
    assert.equal(draftReturnBps(-50, 100, "GROWTH", () => 0.999), 100);
  });

  it("uses the full trader range in Neutral", () => {
    assert.equal(draftReturnBps(-50, 100, "NEUTRAL", () => 0), -50);
    assert.equal(draftReturnBps(-50, 100, "NEUTRAL", () => 0.999), 100);
  });
});
