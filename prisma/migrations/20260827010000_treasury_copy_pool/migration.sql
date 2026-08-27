-- Split treasury bookkeeping: staking yield payouts vs copy-cash payouts.

DO $$ BEGIN
  CREATE TYPE "TreasuryPool" AS ENUM ('STAKING', 'COPY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "TreasuryState"
  ADD COLUMN IF NOT EXISTS "copyBscBalance" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "copyPolygonBalance" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "TreasuryDeposit"
  ADD COLUMN IF NOT EXISTS "pool" "TreasuryPool" NOT NULL DEFAULT 'STAKING';

ALTER TABLE "TreasuryWithdrawal"
  ADD COLUMN IF NOT EXISTS "pool" "TreasuryPool" NOT NULL DEFAULT 'STAKING';

CREATE INDEX IF NOT EXISTS "TreasuryDeposit_pool_network_idx"
  ON "TreasuryDeposit"("pool", "network");

CREATE INDEX IF NOT EXISTS "TreasuryWithdrawal_pool_network_idx"
  ON "TreasuryWithdrawal"("pool", "network");

-- Past copy-cash user payouts were booked against staking liquidity. Move them.
UPDATE "TreasuryWithdrawal" tw
SET "pool" = 'COPY'
FROM "Withdrawal" w
WHERE tw."userWithdrawalId" = w.id
  AND w."source" = 'COPY_CASH';
