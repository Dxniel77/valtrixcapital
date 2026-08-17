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
  showcaseCopiers: z.number().int().min(0).max(200).default(0),
  isActive: z.boolean(),
  isVisible: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.number().int().min(-10_000).max(10_000),
  simulationEnabled: z.boolean(),
  simulationMinBps: z.number().int().min(-10_000).max(10_000),
  simulationMaxBps: z.number().int().min(-10_000).max(10_000),
  simulationIntervalHours: z.number().int().min(1).max(720).optional().default(24),
  simulationMinOpsPerDay: z.number().int().min(1).max(48).default(8),
  simulationMaxOpsPerDay: z.number().int().min(1).max(48).default(20),
  simulationDurationMinMinutes: z.number().int().min(1).max(120).default(3),
  simulationDurationMaxMinutes: z.number().int().min(1).max(120).default(10),
  winProbBps: z.number().int().min(0).max(10_000).default(6000),
  lossProbBps: z.number().int().min(0).max(10_000).default(4000),
  targetMode: z.boolean().default(false),
  monthlyTargetBps: z.number().int().min(-10_000).max(10_000).default(0),
  targetCycleDays: z.number().int().min(1).max(90).default(30),
})
  .refine((value) => value.simulationMinBps <= value.simulationMaxBps, {
    message: "Minimum return cannot exceed maximum",
  })
  .refine((value) => value.simulationMinOpsPerDay <= value.simulationMaxOpsPerDay, {
    message: "Minimum daily operations cannot exceed maximum",
  })
  .refine(
    (value) =>
      value.simulationDurationMinMinutes <= value.simulationDurationMaxMinutes,
    { message: "Minimum duration cannot exceed maximum" },
  );

export const adminCopyTraderTargetSchema = z.object({
  targetMode: z.boolean(),
  monthlyTargetBps: z.number().int().min(-10_000).max(10_000).optional(),
  targetCycleDays: z.number().int().min(1).max(90).optional(),
});

/** Quick toggles from the admin list (Featured / Visible / Active). */
export const adminCopyTraderFlagsSchema = z
  .object({
    isFeatured: z.boolean().optional(),
    isVisible: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.isFeatured !== undefined ||
      value.isVisible !== undefined ||
      value.isActive !== undefined,
    { message: "At least one flag is required" },
  );

export const adminCopyShowcaseRangeSchema = z
  .object({
    min: z.number().int().min(0).max(200),
    max: z.number().int().min(0).max(200),
  })
  .refine((value) => value.min <= value.max, {
    message: "Minimum cannot exceed maximum",
  });

export const adminCopyVitrinaSchema = z.object({
  roiBps: z.number().int().min(-1_000_000).max(1_000_000),
  cumulativeRoiBps: z.number().int().min(-1_000_000).max(1_000_000),
  winRateBps: z.number().int().min(0).max(10_000),
  maxDrawdownBps: z.number().int().min(0).max(10_000),
  profitDays: z.number().int().min(0).max(36_500),
  winningTrades: z.number().int().min(0).max(1_000_000),
  losingTrades: z.number().int().min(0).max(1_000_000),
  experienceDays: z.number().int().min(0).max(36_500),
  followersCount: z.number().int().min(0).max(1_000_000_000),
});

export const adminCopyChartSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valueBps: z.number().int().min(-1_000_000).max(1_000_000).optional(),
});

export const adminCopyOperationSchema = z.object({
  symbol: z.string().trim().min(2).max(20),
  direction: z.enum(["LONG", "SHORT"]),
  leverage: z.number().int().min(1).max(125),
  entryPrice: z.number().finite().positive(),
  targetReturnBps: z.number().int().min(-10_000).max(10_000),
  status: z.enum(["OPEN", "CLOSED"]),
  openedAt: z.string().min(1).optional(),
  closesAt: z.string().min(1),
  closedAt: z.string().min(1).nullable().optional(),
  exitPrice: z.number().finite().positive().nullable().optional(),
  settledReturnBps: z.number().int().min(-10_000).max(10_000).nullable().optional(),
});
