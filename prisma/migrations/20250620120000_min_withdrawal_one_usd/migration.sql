-- Minimum withdrawal: $10 -> $1 USDT (1_000_000 micro-units)
ALTER TABLE "AppConfig" ALTER COLUMN "minWithdrawal" SET DEFAULT 1000000;

UPDATE "AppConfig"
SET "minWithdrawal" = 1000000
WHERE "id" = 1 AND "minWithdrawal" = 10000000;
