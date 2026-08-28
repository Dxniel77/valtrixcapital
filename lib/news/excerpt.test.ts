import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newsExcerpt } from "./excerpt";

describe("newsExcerpt", () => {
  it("returns short text unchanged", () => {
    assert.equal(newsExcerpt("Hola Valtrix"), "Hola Valtrix");
  });

  it("collapses whitespace and truncates", () => {
    const body = "Line one.\n\nLine two is longer than the limit ".repeat(8);
    const excerpt = newsExcerpt(body, 40);
    assert.ok(excerpt.endsWith("…"));
    assert.ok(excerpt.length <= 40);
    assert.equal(excerpt.includes("\n"), false);
  });
});
