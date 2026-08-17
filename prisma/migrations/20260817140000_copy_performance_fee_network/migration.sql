-- Six-level copy network rates (share of each Performance Fee) and
-- a Commission link back to the copier's fee ledger row.

ALTER TABLE "CopyTradingConfig"
ADD COLUMN "performanceFeeNetworkBps" INTEGER[] NOT NULL DEFAULT ARRAY[3000, 1500, 1000, 500, 500, 500]::INTEGER[];

ALTER TABLE "Commission"
ADD COLUMN "sourceCopyLedgerId" TEXT;

CREATE UNIQUE INDEX "Commission_beneficiaryId_sourceCopyLedgerId_level_key"
ON "Commission"("beneficiaryId", "sourceCopyLedgerId", "level");

CREATE INDEX "Commission_sourceCopyLedgerId_idx"
ON "Commission"("sourceCopyLedgerId");

ALTER TABLE "Commission"
ADD CONSTRAINT "Commission_sourceCopyLedgerId_fkey"
FOREIGN KEY ("sourceCopyLedgerId") REFERENCES "CopyInvestmentLedger"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
