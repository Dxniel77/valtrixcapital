-- Daniel standard: new traders default to 30% Performance Fee.
-- Existing rows that still have the old 10% schema default are bumped;
-- any custom per-trader value is left unchanged.
ALTER TABLE "CopyTrader" ALTER COLUMN "performanceFeeBps" SET DEFAULT 3000;

UPDATE "CopyTrader"
SET "performanceFeeBps" = 3000
WHERE "performanceFeeBps" = 1000;
