-- Per-trader win/loss mix and optional monthly return target for live ops.

ALTER TABLE "CopyTrader"
ADD COLUMN "winProbBps" INTEGER NOT NULL DEFAULT 6000,
ADD COLUMN "lossProbBps" INTEGER NOT NULL DEFAULT 4000,
ADD COLUMN "targetMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "monthlyTargetBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "targetCycleDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "targetCycleStartedAt" TIMESTAMP(3);
