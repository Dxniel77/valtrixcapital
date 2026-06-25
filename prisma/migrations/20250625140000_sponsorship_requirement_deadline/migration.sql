-- Sponsorship periods track a deadline to meet withdrawal requirements.

ALTER TYPE "SponsorshipPeriodStatus" ADD VALUE IF NOT EXISTS 'REQUIREMENTS_MET';
ALTER TYPE "SponsorshipPeriodStatus" ADD VALUE IF NOT EXISTS 'REQUIREMENTS_FAILED';

ALTER TABLE "SponsorshipPeriod" ADD COLUMN IF NOT EXISTS "requirementsMetAt" TIMESTAMP(3);
