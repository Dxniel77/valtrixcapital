-- Lower the catalog floor for copy investments to $15 (15_000_000 micro-USDT).
ALTER TABLE "CopyTrader" ALTER COLUMN "minInvestment" SET DEFAULT 15000000;
ALTER TABLE "CopyTradingConfig" ALTER COLUMN "globalMinInvestment" SET DEFAULT 15000000;
