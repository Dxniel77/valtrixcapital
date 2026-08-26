import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  copyTradingTabActive,
  isCopyTradingSection,
} from "./copy-trading-tabs";

describe("copy trading admin tabs", () => {
  it("treats trader desk pages as the Traders tab", () => {
    assert.equal(copyTradingTabActive("/admin/copy-trading", "/admin/copy-trading"), true);
    assert.equal(
      copyTradingTabActive("/admin/copy-trading", "/admin/copy-trading/abc"),
      true,
    );
    assert.equal(
      copyTradingTabActive("/admin/copy-trading", "/admin/copy-trading/income"),
      false,
    );
    assert.equal(
      copyTradingTabActive("/admin/copy-trading/income", "/admin/copy-trading/income"),
      true,
    );
  });

  it("recognizes the whole copy-trading section", () => {
    assert.equal(isCopyTradingSection("/admin/copy-trading/live"), true);
    assert.equal(isCopyTradingSection("/admin/treasury"), false);
  });
});
