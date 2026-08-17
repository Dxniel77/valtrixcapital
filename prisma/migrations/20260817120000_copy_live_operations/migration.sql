-- Per-trader live operation schedule: daily ops range, duration range,
-- persisted UTC-day plan, and admin-only next-open time.

ALTER TABLE "CopyTrader"
ADD COLUMN "simulationMinOpsPerDay" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN "simulationMaxOpsPerDay" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "simulationDurationMinMinutes" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "simulationDurationMaxMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN "simulationOpsDayKey" TEXT,
ADD COLUMN "simulationOpsToday" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "simulationOpsTarget" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "nextOperationAt" TIMESTAMP(3);

CREATE INDEX "CopyTrader_simulationEnabled_nextOperationAt_idx"
ON "CopyTrader"("simulationEnabled", "nextOperationAt");
