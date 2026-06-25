-- Sponsor terms, account deletion, sponsorship calendar

CREATE TYPE "SponsorTermsStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "AccountDeletionStatus" AS ENUM ('REQUESTED', 'GRACE_PERIOD', 'PROCESSING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SponsorshipPeriodStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'RENEWED', 'SUSPENDED');

ALTER TYPE "AdminActionType" ADD VALUE 'UPDATE_SPONSOR_TERMS';
ALTER TYPE "AdminActionType" ADD VALUE 'PROCESS_ACCOUNT_DELETION';
ALTER TYPE "AdminActionType" ADD VALUE 'UPDATE_SPONSORSHIP';

CREATE TABLE "SponsorTermsVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "SponsorTermsStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorTermsVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SponsorTermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsVersionId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "SponsorTermsAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountDeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AccountDeletionStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledFor" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SponsorshipDurationRule" (
    "id" TEXT NOT NULL,
    "minAmountMicro" BIGINT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorshipDurationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SponsorshipPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT,
    "amountMicro" BIGINT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SponsorshipPeriodStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorshipPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SponsorTermsVersion_version_key" ON "SponsorTermsVersion"("version");
CREATE INDEX "SponsorTermsVersion_status_effectiveAt_idx" ON "SponsorTermsVersion"("status", "effectiveAt" DESC);

CREATE UNIQUE INDEX "SponsorTermsAcceptance_userId_termsVersionId_key" ON "SponsorTermsAcceptance"("userId", "termsVersionId");
CREATE INDEX "SponsorTermsAcceptance_userId_idx" ON "SponsorTermsAcceptance"("userId");
CREATE INDEX "SponsorTermsAcceptance_termsVersionId_idx" ON "SponsorTermsAcceptance"("termsVersionId");

CREATE UNIQUE INDEX "AccountDeletionRequest_userId_key" ON "AccountDeletionRequest"("userId");
CREATE INDEX "AccountDeletionRequest_status_requestedAt_idx" ON "AccountDeletionRequest"("status", "requestedAt" DESC);

CREATE INDEX "SponsorshipDurationRule_isActive_minAmountMicro_idx" ON "SponsorshipDurationRule"("isActive", "minAmountMicro" DESC);

CREATE INDEX "SponsorshipPeriod_userId_status_idx" ON "SponsorshipPeriod"("userId", "status");
CREATE INDEX "SponsorshipPeriod_endDate_idx" ON "SponsorshipPeriod"("endDate");
CREATE INDEX "SponsorshipPeriod_status_endDate_idx" ON "SponsorshipPeriod"("status", "endDate");

ALTER TABLE "SponsorTermsVersion" ADD CONSTRAINT "SponsorTermsVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsorTermsAcceptance" ADD CONSTRAINT "SponsorTermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsorTermsAcceptance" ADD CONSTRAINT "SponsorTermsAcceptance_termsVersionId_fkey" FOREIGN KEY ("termsVersionId") REFERENCES "SponsorTermsVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsorshipPeriod" ADD CONSTRAINT "SponsorshipPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsorshipPeriod" ADD CONSTRAINT "SponsorshipPeriod_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "SponsorshipDurationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default rule: $100 = 30 days
INSERT INTO "SponsorshipDurationRule" ("id", "minAmountMicro", "durationDays", "label", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 100000000, 30, '$100 = 30 days', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
