-- Add country attribution to copy traders (marketplace is global, not local-only).
ALTER TABLE "CopyTrader" ADD COLUMN "countryCode" VARCHAR(2);
ALTER TABLE "CopyTrader" ADD COLUMN "countryName" TEXT;
