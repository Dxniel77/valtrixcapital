import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateShowcaseCopiers } from "./showcase-copiers";

const now = new Date("2026-08-14T18:00:00.000Z");

describe("showcase copiers", () => {
  it("is stable for the same trader", () => {
    assert.deepEqual(
      generateShowcaseCopiers("trader-a", 20, now),
      generateShowcaseCopiers("trader-a", 20, now),
    );
  });

  it("creates a different list for each trader", () => {
    assert.notDeepEqual(
      generateShowcaseCopiers("trader-a", 10, now),
      generateShowcaseCopiers("trader-b", 10, now),
    );
  });

  it("masks names and wallet fragments", () => {
    const row = generateShowcaseCopiers("trader-a", 1, now)[0];
    assert.match(row.displayName, /^[A-Z][a-z]\*{5}\d$/);
    assert.match(row.walletHint, /^0x[0-9a-f]{4}…[0-9a-f]{4}$/);
    assert.equal(row.isYou, false);
  });
});
