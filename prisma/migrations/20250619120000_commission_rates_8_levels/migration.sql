-- Eight-level referral commission rates (bps): 20%, 10%, 10%, 10%, 5%, 5%, 5%, 5%
UPDATE "AppConfig"
SET "commissionRatesBps" = ARRAY[2000, 1000, 1000, 1000, 500, 500, 500, 500]::INTEGER[]
WHERE "id" = 1;

ALTER TABLE "AppConfig"
ALTER COLUMN "commissionRatesBps" SET DEFAULT ARRAY[2000, 1000, 1000, 1000, 500, 500, 500, 500]::INTEGER[];
