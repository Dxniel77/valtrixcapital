import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isStakingCommissionDepositPurpose,
  scaleCommissionableAmount,
} from "./sponsored-capital";

describe("staking commissionable capital", () => {
  it("treats only STAKING deposits as commissionable, never COPY", () => {
    assert.equal(isStakingCommissionDepositPurpose("STAKING"), true);
    assert.equal(isStakingCommissionDepositPurpose("COPY"), false);
  });

  it("does not pay staking uplines when the only real money is copy cash", () => {
    const yieldMicro = 10n * 1_000_000n;
    const copyDepositAsIfReal = 1_000n * 1_000_000n;
    const companyLocked = 1_000n * 1_000_000n;

    const wronglyCommissionable = scaleCommissionableAmount(
      yieldMicro,
      copyDepositAsIfReal,
      0n,
    );
    assert.equal(wronglyCommissionable, yieldMicro);

    const copyExcluded = scaleCommissionableAmount(
      yieldMicro,
      0n,
      companyLocked,
    );
    assert.equal(copyExcluded, 0n);
  });
});
