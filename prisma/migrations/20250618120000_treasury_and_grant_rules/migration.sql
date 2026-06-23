-- CreateEnum
CREATE TYPE "TreasuryDepositStatus" AS ENUM ('CONFIRMING', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "TreasuryWithdrawalKind" AS ENUM ('MANUAL', 'USER_PAYOUT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "accountGranted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "withdrawalUnlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "withdrawalRule" JSONB;

-- CreateTable
CREATE TABLE "TreasuryState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "bscBalance" BIGINT NOT NULL DEFAULT 0,
    "polygonBalance" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryDeposit" (
    "id" TEXT NOT NULL,
    "network" "Network" NOT NULL,
    "amount" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "requiredConfirmations" INTEGER NOT NULL,
    "status" "TreasuryDepositStatus" NOT NULL DEFAULT 'CONFIRMING',
    "recordedBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "TreasuryDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryWithdrawal" (
    "id" TEXT NOT NULL,
    "network" "Network" NOT NULL,
    "amount" BIGINT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "txHash" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "kind" "TreasuryWithdrawalKind" NOT NULL DEFAULT 'MANUAL',
    "userWithdrawalId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryDeposit_txHash_key" ON "TreasuryDeposit"("txHash");

-- CreateIndex
CREATE INDEX "TreasuryDeposit_status_startedAt_idx" ON "TreasuryDeposit"("status", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryWithdrawal_userWithdrawalId_key" ON "TreasuryWithdrawal"("userWithdrawalId");

-- CreateIndex
CREATE INDEX "TreasuryWithdrawal_createdAt_idx" ON "TreasuryWithdrawal"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "TreasuryWithdrawal" ADD CONSTRAINT "TreasuryWithdrawal_userWithdrawalId_fkey" FOREIGN KEY ("userWithdrawalId") REFERENCES "Withdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed singleton treasury row
INSERT INTO "TreasuryState" ("id", "bscBalance", "polygonBalance", "updatedAt")
VALUES (1, 0, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
