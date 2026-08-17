-- Showcase history (no copier settlement) + global active coins for live copy ops.

ALTER TABLE "CopyTraderOperation"
ADD COLUMN "synthetic" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CopyTraderOperation_traderId_synthetic_closedAt_idx"
ON "CopyTraderOperation"("traderId", "synthetic", "closedAt");

ALTER TABLE "CopyTradingConfig"
ADD COLUMN "activeSymbols" TEXT[] NOT NULL DEFAULT ARRAY[
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'TRXUSDT',
  'LINKUSDT',
  'AVAXUSDT'
]::TEXT[];

CREATE TABLE "CopyScheduledManualResult" (
  "id" TEXT NOT NULL,
  "traderId" TEXT NOT NULL,
  "returnBps" INTEGER NOT NULL,
  "executeAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "canceledAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),

  CONSTRAINT "CopyScheduledManualResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CopyScheduledManualResult_executeAt_canceledAt_executedAt_idx"
ON "CopyScheduledManualResult"("executeAt", "canceledAt", "executedAt");

CREATE INDEX "CopyScheduledManualResult_traderId_executeAt_idx"
ON "CopyScheduledManualResult"("traderId", "executeAt");

ALTER TABLE "CopyScheduledManualResult"
ADD CONSTRAINT "CopyScheduledManualResult_traderId_fkey"
FOREIGN KEY ("traderId") REFERENCES "CopyTrader"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
