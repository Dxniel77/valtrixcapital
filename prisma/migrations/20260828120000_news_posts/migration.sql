-- Admin-authored news feed (text + optional cover image).

CREATE TABLE IF NOT EXISTS "NewsPost" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "imageBytes" BYTEA,
  "imageMime" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),

  CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NewsPost_published_pinned_publishedAt_idx"
  ON "NewsPost"("published", "pinned" DESC, "publishedAt" DESC);

CREATE INDEX IF NOT EXISTS "NewsPost_createdAt_idx"
  ON "NewsPost"("createdAt" DESC);
