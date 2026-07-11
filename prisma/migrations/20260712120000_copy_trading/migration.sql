-- Copy Trading + push device tokens (additive — safe for live users)

CREATE TYPE "CopyRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "CopyPeriod" AS ENUM ('TODAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ALL_TIME');
CREATE TYPE "CopyInvestmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');
CREATE TYPE "CopyWithdrawalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED');
CREATE TYPE "CopyWithdrawalMode" AS ENUM ('INSTANT', 'APPROVAL');
CREATE TYPE "CopyLedgerKind" AS ENUM ('INVEST', 'PNL', 'WITHDRAWAL');

CREATE TABLE "CopyTrader" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "description" TEXT NOT NULL,
    "riskLevel" "CopyRiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "experienceDays" INTEGER NOT NULL DEFAULT 0,
    "profitDays" INTEGER NOT NULL DEFAULT 0,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "investorsCount" INTEGER NOT NULL DEFAULT 0,
    "aum" BIGINT NOT NULL DEFAULT 0,
    "totalInvested" BIGINT NOT NULL DEFAULT 0,
    "roiBps" INTEGER NOT NULL DEFAULT 0,
    "cumulativeRoiBps" INTEGER NOT NULL DEFAULT 0,
    "winRateBps" INTEGER NOT NULL DEFAULT 0,
    "maxDrawdownBps" INTEGER NOT NULL DEFAULT 0,
    "tradeVolume" BIGINT NOT NULL DEFAULT 0,
    "winningTrades" INTEGER NOT NULL DEFAULT 0,
    "losingTrades" INTEGER NOT NULL DEFAULT 0,
    "minInvestment" BIGINT NOT NULL DEFAULT 100000000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CopyTrader_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CopyTraderPerformance" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "period" "CopyPeriod" NOT NULL,
    "returnBps" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CopyTraderPerformance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CopyTraderChartPoint" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "valueBps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CopyTraderChartPoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CopyInvestment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "principal" BIGINT NOT NULL,
    "currentValue" BIGINT NOT NULL,
    "realizedPnl" BIGINT NOT NULL DEFAULT 0,
    "status" "CopyInvestmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "CopyInvestment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CopyInvestmentLedger" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "kind" "CopyLedgerKind" NOT NULL,
    "amount" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "performanceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CopyInvestmentLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CopyWithdrawal" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "CopyWithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    CONSTRAINT "CopyWithdrawal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CopyTradingConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "globalMinInvestment" BIGINT NOT NULL DEFAULT 100000000,
    "withdrawalMode" "CopyWithdrawalMode" NOT NULL DEFAULT 'APPROVAL',
    "notifyOnPerformance" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CopyTradingConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CopyTraderPerformance_traderId_period_key" ON "CopyTraderPerformance"("traderId", "period");
CREATE UNIQUE INDEX "CopyTraderChartPoint_traderId_date_key" ON "CopyTraderChartPoint"("traderId", "date");
CREATE INDEX "CopyTrader_isVisible_isActive_sortOrder_idx" ON "CopyTrader"("isVisible", "isActive", "sortOrder");
CREATE INDEX "CopyTrader_roiBps_idx" ON "CopyTrader"("roiBps");
CREATE INDEX "CopyTraderChartPoint_traderId_date_idx" ON "CopyTraderChartPoint"("traderId", "date");
CREATE INDEX "CopyInvestment_userId_status_idx" ON "CopyInvestment"("userId", "status");
CREATE INDEX "CopyInvestment_traderId_status_idx" ON "CopyInvestment"("traderId", "status");
CREATE INDEX "CopyInvestmentLedger_investmentId_createdAt_idx" ON "CopyInvestmentLedger"("investmentId", "createdAt");
CREATE INDEX "CopyWithdrawal_userId_status_idx" ON "CopyWithdrawal"("userId", "status");
CREATE INDEX "CopyWithdrawal_status_requestedAt_idx" ON "CopyWithdrawal"("status", "requestedAt");
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

ALTER TABLE "CopyTraderPerformance" ADD CONSTRAINT "CopyTraderPerformance_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "CopyTrader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopyTraderChartPoint" ADD CONSTRAINT "CopyTraderChartPoint_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "CopyTrader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopyInvestment" ADD CONSTRAINT "CopyInvestment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CopyInvestment" ADD CONSTRAINT "CopyInvestment_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "CopyTrader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CopyInvestmentLedger" ADD CONSTRAINT "CopyInvestmentLedger_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "CopyInvestment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopyWithdrawal" ADD CONSTRAINT "CopyWithdrawal_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "CopyInvestment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CopyWithdrawal" ADD CONSTRAINT "CopyWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CopyTradingConfig" ("id", "globalMinInvestment", "withdrawalMode", "notifyOnPerformance", "updatedAt")
VALUES (1, 100000000, 'APPROVAL', true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
