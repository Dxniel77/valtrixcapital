-- IB acceleration strategies (additive — no existing data removed)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AdminActionType' AND e.enumlabel = 'CREATE_IB_STRATEGY'
  ) THEN
    ALTER TYPE "AdminActionType" ADD VALUE 'CREATE_IB_STRATEGY';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AdminActionType' AND e.enumlabel = 'UPDATE_IB_STRATEGY'
  ) THEN
    ALTER TYPE "AdminActionType" ADD VALUE 'UPDATE_IB_STRATEGY';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AdminActionType' AND e.enumlabel = 'ASSIGN_IB_STRATEGY'
  ) THEN
    ALTER TYPE "AdminActionType" ADD VALUE 'ASSIGN_IB_STRATEGY';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "IbStrategy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "passiveBonusBps" INTEGER NOT NULL DEFAULT 0,
    "tradeBonusExtraBps" INTEGER NOT NULL DEFAULT 0,
    "commissionRatesBps" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IbStrategy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IbStrategy_isActive_idx" ON "IbStrategy"("isActive");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ibStrategyId" TEXT;

DO $$ BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_ibStrategyId_fkey"
    FOREIGN KEY ("ibStrategyId") REFERENCES "IbStrategy"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "User_ibStrategyId_idx" ON "User"("ibStrategyId");
