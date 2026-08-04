-- IB Net Deposit agreements + credit ledger (keeps existing IbStrategy data)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AdminActionType' AND e.enumlabel = 'UPSERT_IB_AGREEMENT'
  ) THEN
    ALTER TYPE "AdminActionType" ADD VALUE 'UPSERT_IB_AGREEMENT';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AdminActionType' AND e.enumlabel = 'IB_NET_DEPOSIT_CREDIT'
  ) THEN
    ALTER TYPE "AdminActionType" ADD VALUE 'IB_NET_DEPOSIT_CREDIT';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "IbAgreement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isIb" BOOLEAN NOT NULL DEFAULT true,
    "netDepositEnabled" BOOLEAN NOT NULL DEFAULT false,
    "level1DepositBps" INTEGER NOT NULL DEFAULT 0,
    "level2DepositBps" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IbAgreement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IbAgreement_userId_key" ON "IbAgreement"("userId");
CREATE INDEX IF NOT EXISTS "IbAgreement_isIb_idx" ON "IbAgreement"("isIb");
CREATE INDEX IF NOT EXISTS "IbAgreement_netDepositEnabled_idx" ON "IbAgreement"("netDepositEnabled");

DO $$ BEGIN
  ALTER TABLE "IbAgreement"
    ADD CONSTRAINT "IbAgreement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "IbNetDepositCredit" (
    "id" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "agreementId" TEXT,
    "level" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "depositAmount" BIGINT NOT NULL,
    "creditedAmount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IbNetDepositCredit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IbNetDepositCredit_beneficiaryId_depositId_key"
  ON "IbNetDepositCredit"("beneficiaryId", "depositId");
CREATE INDEX IF NOT EXISTS "IbNetDepositCredit_beneficiaryId_createdAt_idx"
  ON "IbNetDepositCredit"("beneficiaryId", "createdAt");
CREATE INDEX IF NOT EXISTS "IbNetDepositCredit_depositId_idx"
  ON "IbNetDepositCredit"("depositId");
CREATE INDEX IF NOT EXISTS "IbNetDepositCredit_sourceUserId_idx"
  ON "IbNetDepositCredit"("sourceUserId");

DO $$ BEGIN
  ALTER TABLE "IbNetDepositCredit"
    ADD CONSTRAINT "IbNetDepositCredit_beneficiaryId_fkey"
    FOREIGN KEY ("beneficiaryId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "IbNetDepositCredit"
    ADD CONSTRAINT "IbNetDepositCredit_sourceUserId_fkey"
    FOREIGN KEY ("sourceUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "IbNetDepositCredit"
    ADD CONSTRAINT "IbNetDepositCredit_depositId_fkey"
    FOREIGN KEY ("depositId") REFERENCES "Deposit"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "IbNetDepositCredit"
    ADD CONSTRAINT "IbNetDepositCredit_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "IbAgreement"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
