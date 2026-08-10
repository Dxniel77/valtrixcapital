-- IB profile avatar (URL). Editable only while the user is marked as IB.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
