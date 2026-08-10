-- Store compressed IB avatars in Neon (Bytes). Suitable for small IB counts.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarBytes" BYTEA;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarMime" TEXT;
