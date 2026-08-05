-- Simulated trader operation lifecycle. Additive: no existing data is removed.

CREATE TABLE "CopyTraderOperation" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "entryPrice" DECIMAL(20,8) NOT NULL,
    "targetReturnBps" INTEGER NOT NULL,
    "exitPrice" DECIMAL(20,8),
    "settledReturnBps" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openKey" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "performanceEventId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CopyTraderOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CopyTraderOperation_idempotencyKey_key"
ON "CopyTraderOperation"("idempotencyKey");

CREATE UNIQUE INDEX "CopyTraderOperation_openKey_key"
ON "CopyTraderOperation"("openKey");

CREATE UNIQUE INDEX "CopyTraderOperation_performanceEventId_key"
ON "CopyTraderOperation"("performanceEventId");

CREATE INDEX "CopyTraderOperation_traderId_status_openedAt_idx"
ON "CopyTraderOperation"("traderId", "status", "openedAt" DESC);

CREATE INDEX "CopyTraderOperation_status_closesAt_idx"
ON "CopyTraderOperation"("status", "closesAt");

ALTER TABLE "CopyTraderOperation"
ADD CONSTRAINT "CopyTraderOperation_traderId_fkey"
FOREIGN KEY ("traderId") REFERENCES "CopyTrader"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CopyTraderOperation"
ADD CONSTRAINT "CopyTraderOperation_performanceEventId_fkey"
FOREIGN KEY ("performanceEventId") REFERENCES "CopyPerformanceEvent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
