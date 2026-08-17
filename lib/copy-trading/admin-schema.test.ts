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
  performanceFeeBps: 1000,
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
