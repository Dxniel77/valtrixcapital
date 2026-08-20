-- On-chain deposits can credit staking capital or idle copy cash.
DO $$ BEGIN
  CREATE TYPE "DepositPurpose" AS ENUM ('STAKING', 'COPY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "purpose" "DepositPurpose" NOT NULL DEFAULT 'STAKING';
