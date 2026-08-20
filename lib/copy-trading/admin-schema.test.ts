import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminCopyTraderSchema } from "./admin-schema";

const base = {
  name: "Alpha",
  description: "Live trader",
  riskLevel: "MEDIUM" as const,
  experienceDays: 365,
  followersCount: 10,
  minInvestment: 15,
  performanceFeeBps: 3000,
  maxInvestors: 180,
  showcaseCopiers: 20,
  isActive: true,
  isVisible: true,
  isFeatured: false,
  sortOrder: 0,
  simulationEnabled: true,
  simulationMinBps: -50,
  simulationMaxBps: 100,
};

describe("admin copy trader schema", () => {
  it("defaults live operation ranges", () => {
    const parsed = adminCopyTraderSchema.parse(base);
    assert.equal(parsed.simulationMinOpsPerDay, 8);
    assert.equal(parsed.simulationMaxOpsPerDay, 20);
    assert.equal(parsed.simulationDurationMinMinutes, 3);
    assert.equal(parsed.simulationDurationMaxMinutes, 10);
    assert.equal(parsed.simulationIntervalHours, 24);
    assert.equal(parsed.winProbBps, 6000);
    assert.equal(parsed.lossProbBps, 4000);
    assert.equal(parsed.targetMode, false);
    assert.equal(parsed.monthlyTargetBps, 0);
    assert.equal(parsed.targetCycleDays, 30);
    assert.equal(parsed.performanceFeeBps, 3000);
  });

  it("defaults Performance Fee to 30% when omitted", () => {
    const { performanceFeeBps: _omitted, ...withoutFee } = base;
    const parsed = adminCopyTraderSchema.parse(withoutFee);
    assert.equal(parsed.performanceFeeBps, 3000);
  });

  it("rejects inverted daily operation bounds", () => {
    const parsed = adminCopyTraderSchema.safeParse({
      ...base,
      simulationMinOpsPerDay: 20,
      simulationMaxOpsPerDay: 8,
    });
    assert.equal(parsed.success, false);
  });

  it("rejects inverted duration bounds", () => {
    const parsed = adminCopyTraderSchema.safeParse({
      ...base,
      simulationDurationMinMinutes: 10,
      simulationDurationMaxMinutes: 3,
    });
    assert.equal(parsed.success, false);
  });
});
