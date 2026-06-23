-- Fix L5–L8 commission rates when L1–L4 are correct bps but deep levels are
-- zero, percent integers (5), or 10× under-scaled (50).
UPDATE "AppConfig"
SET "commissionRatesBps" = ARRAY[2000, 1000, 1000, 1000, 500, 500, 500, 500]::INTEGER[]
WHERE id = 1
  AND cardinality("commissionRatesBps") >= 4
  AND "commissionRatesBps"[1] >= 1000
  AND (
    COALESCE("commissionRatesBps"[5], 0) NOT IN (500)
    OR COALESCE("commissionRatesBps"[6], 0) NOT IN (500)
    OR COALESCE("commissionRatesBps"[7], 0) NOT IN (500)
    OR COALESCE("commissionRatesBps"[8], 0) NOT IN (500)
  );
