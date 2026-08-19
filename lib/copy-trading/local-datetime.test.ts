import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isoToLocalInput, localInputToIso } from "./local-datetime";

describe("local datetime-local roundtrip", () => {
  it("treats datetime-local as local time, not UTC", () => {
    const iso = localInputToIso("2026-08-19T07:14");
    const expected = new Date(2026, 7, 19, 7, 14, 0, 0).toISOString();
    assert.equal(iso, expected);
  });

  it("round-trips through the input value", () => {
    const original = new Date(2026, 7, 19, 7, 14, 0, 0);
    const input = isoToLocalInput(original.toISOString());
    assert.equal(input, "2026-08-19T07:14");
    assert.equal(localInputToIso(input), original.toISOString());
  });
});
