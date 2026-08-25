-- Agreed copy-trading fees: 1% on capital in, 0.03% on capital out,
-- 0.05% per open already defaults to 5 bps.
ALTER TABLE "CopyTradingConfig" ALTER COLUMN "investFeeBps" SET DEFAULT 100;
ALTER TABLE "CopyTradingConfig" ALTER COLUMN "withdrawFeeBps" SET DEFAULT 3;

UPDATE "CopyTradingConfig"
SET
  "investFeeBps" = 100,
  "withdrawFeeBps" = 3
WHERE id = 1;
