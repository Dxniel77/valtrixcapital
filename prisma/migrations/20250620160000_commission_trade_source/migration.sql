-- Allow referral commissions from trade wins (not only daily yield).
ALTER TABLE "Commission" ALTER COLUMN "sourceYieldId" DROP NOT NULL;

ALTER TABLE "Commission" ADD COLUMN "sourceTradeId" TEXT;

ALTER TABLE "Commission"
  ADD CONSTRAINT "Commission_sourceTradeId_fkey"
  FOREIGN KEY ("sourceTradeId") REFERENCES "Trade"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Commission_sourceTradeId_idx" ON "Commission"("sourceTradeId");
