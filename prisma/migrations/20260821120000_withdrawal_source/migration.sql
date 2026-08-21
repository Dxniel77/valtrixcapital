-- Wallet withdrawals can debit staking earnings or idle copy cash.
DO $$ BEGIN
  CREATE TYPE "WithdrawalSource" AS ENUM ('EARNINGS', 'COPY_CASH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "source" "WithdrawalSource" NOT NULL DEFAULT 'EARNINGS';
