-- Idempotent: objects may already exist from prior db push / partial apply
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "SupportTicket_wallet_idx" ON "SupportTicket"("wallet");
CREATE INDEX IF NOT EXISTS "SupportTicket_email_idx" ON "SupportTicket"("email");

DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SupportTicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT,
    "replyId" TEXT,
    "uploaderWallet" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupportTicketAttachment_ticketId_idx" ON "SupportTicketAttachment"("ticketId");
CREATE INDEX IF NOT EXISTS "SupportTicketAttachment_replyId_idx" ON "SupportTicketAttachment"("replyId");

DO $$ BEGIN
  ALTER TABLE "SupportTicketAttachment" ADD CONSTRAINT "SupportTicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportTicketAttachment" ADD CONSTRAINT "SupportTicketAttachment_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "SupportTicketReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
