import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  absFeeMicro,
  copyIncomeBucketKey,
  copyIncomeBucketLabels,
  copyIncomeRange,
  isCopyIncomePeriod,
  parseCopyInOutFeeMicro,
  utcIsoWeekStart,
  utcMonthStart,
  utcQuarterStart,
} from "./income-period";

describe("copy income periods", () => {
  it("accepts only the five report periods", () => {
    assert.equal(isCopyIncomePeriod("DAY"), true);
    assert.equal(isCopyIncomePeriod("YEAR"), false);
  });

  it("uses UTC calendar bounds for day, week, month and quarter", () => {
    const now = new Date("2026-08-17T15:30:00.000Z");
    assert.equal(
      copyIncomeRange("DAY", now).from?.toISOString(),
      "2026-08-17T00:00:00.000Z",
    );
    assert.equal(utcIsoWeekStart(now).toISOString(), "2026-08-17T00:00:00.000Z");
    assert.equal(utcMonthStart(now).toISOString(), "2026-08-01T00:00:00.000Z");
    assert.equal(utcQuarterStart(now).toISOString(), "2026-07-01T00:00:00.000Z");
    assert.equal(copyIncomeRange("ALL", now).from, null);
  });

  it("starts an ISO week on Monday UTC", () => {
    const sunday = new Date("2026-08-16T08:00:00.000Z");
    assert.equal(utcIsoWeekStart(sunday).toISOString(), "2026-08-10T00:00:00.000Z");
  });

  it("buckets days for week/month and months for quarter/all", () => {
    const now = new Date("2026-08-17T12:00:00.000Z");
    assert.equal(copyIncomeBucketKey("DAY", now), "2026-08-17");
    assert.equal(copyIncomeBucketKey("ALL", now), "2026-08");
    const week = copyIncomeRange("WEEK", now);
    assert.deepEqual(copyIncomeBucketLabels("WEEK", week.from, now), [
      "2026-08-17",
    ]);
  });

  it("reads copy in/out fees from ledger notes and abs-values platform rows", () => {
    assert.equal(parseCopyInOutFeeMicro("Initial copy investment (fee 1.5 USDT)"), 1_500_000n);
    assert.equal(absFeeMicro(-50_000n), 50_000n);
    assert.equal(parseCopyInOutFeeMicro("Initial copy investment"), 0n);
  });
});
