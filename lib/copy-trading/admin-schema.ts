import { z } from "zod";

export const adminCopyTraderSchema = z.object({
  name: z.string().trim().min(1).max(80),
  photoUrl: z.string().trim().url().max(500).nullable().optional().or(z.literal("")),
  description: z.string().trim().min(1).max(1000),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  experienceDays: z.number().int().min(0).max(36_500),
  followersCount: z.number().int().min(0).max(1_000_000_000),
  minInvestment: z.number().finite().min(0).max(1_000_000_000),
  performanceFeeBps: z.number().int().min(0).max(10_000).default(1000),
  maxInvestors: z.number().int().min(1).max(1_000_000).default(180),
  isActive: z.boolean(),
  isVisible: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.number().int().min(-10_000).max(10_000),
  simulationEnabled: z.boolean(),
  simulationMinBps: z.number().int().min(-10_000).max(10_000),
  simulationMaxBps: z.number().int().min(-10_000).max(10_000),
  simulationIntervalHours: z.number().int().min(1).max(720),
});
