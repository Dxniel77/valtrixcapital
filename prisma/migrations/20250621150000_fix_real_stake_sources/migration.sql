-- Deposits linked to stakes must count as real capital for network commissions.
UPDATE "Stake"
SET "source" = 'ON_CHAIN'
WHERE "depositId" IS NOT NULL
  AND "source" = 'COMPANY_SPONSORED';

-- Fix commission rates stored as whole percents (20 = 20%) instead of bps (2000).
UPDATE "AppConfig"
SET "commissionRatesBps" = ARRAY[2000, 1000, 1000, 1000, 500, 500, 500, 500]::INTEGER[]
WHERE id = 1
  AND "commissionRatesBps" = ARRAY[20, 10, 10, 10, 5, 5, 5, 5]::INTEGER[];

-- Legacy seven-level rates from initial deploy.
UPDATE "AppConfig"
SET "commissionRatesBps" = ARRAY[2000, 1000, 1000, 1000, 500, 500, 500, 500]::INTEGER[]
WHERE id = 1
  AND "commissionRatesBps" = ARRAY[700, 300, 200, 100, 100, 50, 50]::INTEGER[];
