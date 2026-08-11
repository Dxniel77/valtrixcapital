-- Additive copy-trading fees + settlement cutoff. No rows deleted.

ALTER TABLE "CopyTradingConfig"
  ADD COLUMN IF NOT EXISTS "investFeeBps" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CopyTradingConfig"
  ADD COLUMN IF NOT EXISTS "withdrawFeeBps" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CopyTradingConfig"
  ADD COLUMN IF NOT EXISTS "settlementCutoffHour" INTEGER NOT NULL DEFAULT 22;
