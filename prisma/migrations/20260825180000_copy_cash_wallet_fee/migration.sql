-- Leave-trader is free. 0.03% applies only when copy cash goes to a wallet.
ALTER TABLE "CopyTradingConfig" ALTER COLUMN "withdrawFeeBps" SET DEFAULT 0;
ALTER TABLE "CopyTradingConfig" ADD COLUMN IF NOT EXISTS "copyCashWalletFeeBps" INTEGER NOT NULL DEFAULT 3;

UPDATE "CopyTradingConfig"
SET
  "withdrawFeeBps" = 0,
  "copyCashWalletFeeBps" = 3
WHERE id = 1;
