-- Partial withdrawal release for sponsored (volume-locked) accounts.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "withdrawalAllowance" BIGINT NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AdminActionType'
      AND e.enumlabel = 'RELEASE_WITHDRAWAL_ALLOWANCE'
  ) THEN
    ALTER TYPE "AdminActionType" ADD VALUE 'RELEASE_WITHDRAWAL_ALLOWANCE';
  END IF;
END $$;
