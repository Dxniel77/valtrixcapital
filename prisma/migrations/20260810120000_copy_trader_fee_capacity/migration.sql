-- Additive only: profit-share fee + investor capacity for copy traders.
-- Does not delete or modify existing rows beyond DEFAULT backfill.

ALTER TABLE "CopyTrader"
  ADD COLUMN IF NOT EXISTS "performanceFeeBps" INTEGER NOT NULL DEFAULT 1000;

ALTER TABLE "CopyTrader"
  ADD COLUMN IF NOT EXISTS "maxInvestors" INTEGER NOT NULL DEFAULT 180;
