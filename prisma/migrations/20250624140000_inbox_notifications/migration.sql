-- CreateEnum (idempotent — may already exist from a prior failed/partial apply)
DO $$ BEGIN
  CREATE TYPE "InboxAudience" AS ENUM ('USER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "InboxNotification" (
    "id" TEXT NOT NULL,
    "audience" "InboxAudience" NOT NULL,
    "userId" TEXT,
    "wallet" TEXT,
    "email" TEXT,
    "kind" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "href" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InboxNotification_dedupeKey_key" ON "InboxNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InboxNotification_audience_createdAt_idx" ON "InboxNotification"("audience", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InboxNotification_userId_createdAt_idx" ON "InboxNotification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InboxNotification_wallet_createdAt_idx" ON "InboxNotification"("wallet", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InboxNotification_email_createdAt_idx" ON "InboxNotification"("email", "createdAt" DESC);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "InboxNotification" ADD CONSTRAINT "InboxNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
