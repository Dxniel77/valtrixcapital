-- Restore full 8-level commission rates when only L1 was configured.
UPDATE "AppConfig"
SET "commissionRatesBps" = ARRAY[2000, 1000, 1000, 1000, 500, 500, 500, 500]::INTEGER[]
WHERE id = 1
  AND (
    cardinality("commissionRatesBps") < 8
    OR (
      "commissionRatesBps"[1] > 0
      AND COALESCE("commissionRatesBps"[2], 0) = 0
      AND COALESCE("commissionRatesBps"[3], 0) = 0
    )
  );
