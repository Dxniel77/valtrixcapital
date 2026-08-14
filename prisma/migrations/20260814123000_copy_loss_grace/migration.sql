-- Protect new copy investments from negative daily results for a configurable period.
ALTER TABLE "CopyTradingConfig"
  ADD COLUMN IF NOT EXISTS "lossGraceDays" INTEGER NOT NULL DEFAULT 2;
