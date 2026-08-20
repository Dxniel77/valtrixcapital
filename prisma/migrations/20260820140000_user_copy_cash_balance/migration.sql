-- Idle copy-trading cash, separate from staking locked capital and withdrawable earnings.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "copyCashBalance" BIGINT NOT NULL DEFAULT 0;
