-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "HotWalletAsset" AS ENUM ('NATIVE', 'USDT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "HotWalletOutflowReviewStatus" AS ENUM ('IGNORED', 'REGISTERED_TREASURY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AdminActionType' AND e.enumlabel = 'RECONCILE_HOT_WALLET_TX'
  ) THEN
    ALTER TYPE "AdminActionType" ADD VALUE 'RECONCILE_HOT_WALLET_TX';
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "HotWalletOutflowReview" (
    "id" TEXT NOT NULL,
    "network" "Network" NOT NULL,
    "asset" "HotWalletAsset" NOT NULL,
    "txHash" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "status" "HotWalletOutflowReviewStatus" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotWalletOutflowReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HotWalletOutflowReview_network_txHash_key"
  ON "HotWalletOutflowReview"("network", "txHash");

CREATE INDEX IF NOT EXISTS "HotWalletOutflowReview_reviewedAt_idx"
  ON "HotWalletOutflowReview"("reviewedAt" DESC);

CREATE INDEX IF NOT EXISTS "HotWalletOutflowReview_status_idx"
  ON "HotWalletOutflowReview"("status");

DO $$ BEGIN
  ALTER TABLE "HotWalletOutflowReview"
    ADD CONSTRAINT "HotWalletOutflowReview_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
