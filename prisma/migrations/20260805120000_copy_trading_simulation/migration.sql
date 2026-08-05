-- Admin-controlled copy-trading simulation and idempotent performance events.
-- Additive migration: existing traders, investments, and ledger data are preserved.

ALTER TABLE "CopyTrader"
ADD COLUMN "simulationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "simulationMinBps" INTEGER NOT NULL DEFAULT -50,
ADD COLUMN "simulationMaxBps" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "simulationIntervalHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN "simulationLastRunAt" TIMESTAMP(3),
ADD COLUMN "simulationNextRunAt" TIMESTAMP(3);

CREATE TABLE "CopyPerformanceEvent" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "period" "CopyPeriod" NOT NULL DEFAULT 'TODAY',
    "returnBps" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ADMIN',
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CopyPerformanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CopyPerformanceEvent_idempotencyKey_key"
ON "CopyPerformanceEvent"("idempotencyKey");

CREATE INDEX "CopyPerformanceEvent_traderId_createdAt_idx"
ON "CopyPerformanceEvent"("traderId", "createdAt" DESC);

CREATE INDEX "CopyPerformanceEvent_source_createdAt_idx"
ON "CopyPerformanceEvent"("source", "createdAt" DESC);

CREATE INDEX "CopyTrader_simulationEnabled_simulationNextRunAt_idx"
ON "CopyTrader"("simulationEnabled", "simulationNextRunAt");

ALTER TABLE "CopyPerformanceEvent"
ADD CONSTRAINT "CopyPerformanceEvent_traderId_fkey"
FOREIGN KEY ("traderId") REFERENCES "CopyTrader"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
