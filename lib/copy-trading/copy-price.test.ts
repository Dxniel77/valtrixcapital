import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogFallbackPrice,
  formatCopyPriceInput,
  isCatalogDemoPrice,
  roundCopyPrice,
} from "./copy-price";

describe("copy-price", () => {
  it("treats catalog stubs as demo data", () => {
    assert.equal(isCatalogDemoPrice("BTCUSDT", 114_250), true);
    assert.equal(isCatalogDemoPrice("BTCUSDT", 114_250 * 1.018), true);
    assert.equal(isCatalogDemoPrice("ethusdt", 3_720), true);
    assert.equal(isCatalogDemoPrice("BTCUSDT", 97_400), false);
    assert.equal(isCatalogDemoPrice("BTCUSDT", 0), false);
  });

  it("falls back to the catalog only by symbol", () => {
    assert.equal(catalogFallbackPrice("BTCUSDT"), 114_250);
    assert.equal(catalogFallbackPrice("DOGEUSDT"), 0.22);
    assert.equal(catalogFallbackPrice("UNKNOWN"), null);
  });

  it("rounds by magnitude so live fills look like exchange ticks", () => {
    assert.equal(roundCopyPrice(108_234.567), 108_234.57);
    assert.equal(roundCopyPrice(18.43219), 18.4322);
    assert.equal(roundCopyPrice(0.2214567), 0.221457);
    assert.equal(formatCopyPriceInput(108_234.5), "108234.50");
  });
});
