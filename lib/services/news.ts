import { prisma } from "@/lib/db";
import { publishPlatformBroadcast } from "@/lib/notifications/broadcast-server";
import { newsExcerpt } from "@/lib/news/excerpt";
import {
  NEWS_BODY_MAX,
  NEWS_TITLE_MAX,
  NewsImageError,
  newsImagePublicPath,
  parseNewsImagePayload,
} from "@/lib/news/image";

export class NewsError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "INVALID",
  ) {
    super(message);
    this.name = "NewsError";
  }
}

export type NewsPostDto = {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  published: boolean;
  pinned: boolean;
  hasImage: boolean;
  imageUrl: string | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

const LIST_SELECT = {
  id: true,
  title: true,
  body: true,
  published: true,
  pinned: true,
  imageMime: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
} as const;

function hasCover(row: { imageMime: string | null }): boolean {
  return Boolean(row.imageMime);
}

function serialize(
  row: {
    id: string;
    title: string;
    body: string;
    published: boolean;
    pinned: boolean;
    imageMime: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
  },
  opts?: { forAdmin?: boolean },
): NewsPostDto {
  const cover = hasCover(row);
  const dto: NewsPostDto = {
    id: row.id,
    title: row.title,
    body: row.body,
    excerpt: newsExcerpt(row.body),
    published: row.published,
    pinned: row.pinned,
    hasImage: cover,
    imageUrl: cover ? newsImagePublicPath(row.id, row.updatedAt.getTime()) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
  if (opts?.forAdmin) dto.createdBy = row.createdBy;
  return dto;
}

export type NewsWriteInput = {
  title: string;
  body: string;
  published?: boolean;
  pinned?: boolean;
  notify?: boolean;
  clearImage?: boolean;
  image?: { dataBase64: string; mime?: string } | null;
};

function normalizeWrite(input: NewsWriteInput): {
  title: string;
  body: string;
  published: boolean;
  pinned: boolean;
} {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || title.length > NEWS_TITLE_MAX) {
    throw new NewsError("Invalid title", "INVALID");
  }
  if (!body || body.length > NEWS_BODY_MAX) {
    throw new NewsError("Invalid body", "INVALID");
  }
  return {
    title,
    body,
    published: input.published !== false,
    pinned: input.pinned === true,
  };
}

function imageUpdate(input: NewsWriteInput): {
  imageBytes?: Buffer | null;
  imageMime?: string | null;
} {
  if (input.clearImage) {
    return { imageBytes: null, imageMime: null };
  }
  if (!input.image?.dataBase64) return {};
  const parsed = parseNewsImagePayload(input.image);
  return { imageBytes: parsed.bytes, imageMime: parsed.mime };
}

async function maybeNotify(input: {
  notify?: boolean;
  published: boolean;
  post: NewsPostDto;
  createdBy: string;
}): Promise<void> {
  if (!input.notify || !input.published) return;
  await publishPlatformBroadcast({
    kind: "promo",
    title: input.post.title,
    body: input.post.excerpt,
    href: `/dashboard/news/${input.post.id}`,
    createdBy: input.createdBy,
  });
}

export async function listPublishedNews(limit = 50): Promise<NewsPostDto[]> {
  const rows = await prisma.newsPost.findMany({
    where: { published: true },
    select: LIST_SELECT,
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: Math.min(100, Math.max(1, limit)),
  });
  return rows.map((row) => serialize(row));
}

export async function listAdminNews(limit = 80): Promise<NewsPostDto[]> {
  const rows = await prisma.newsPost.findMany({
    select: LIST_SELECT,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: Math.min(100, Math.max(1, limit)),
  });
  return rows.map((row) => serialize(row, { forAdmin: true }));
}

export async function getPublishedNewsPost(id: string): Promise<NewsPostDto | null> {
  const row = await prisma.newsPost.findFirst({
    where: { id, published: true },
    select: LIST_SELECT,
  });
  return row ? serialize(row) : null;
}

export async function getAdminNewsPost(id: string): Promise<NewsPostDto | null> {
  const row = await prisma.newsPost.findUnique({
    where: { id },
    select: LIST_SELECT,
  });
  return row ? serialize(row, { forAdmin: true }) : null;
}

export async function getNewsImage(
  id: string,
  opts: { allowUnpublished: boolean },
): Promise<{ data: Buffer; mime: string; updatedAt: Date } | null> {
  const row = await prisma.newsPost.findUnique({
    where: { id },
    select: {
      published: true,
      imageBytes: true,
      imageMime: true,
      updatedAt: true,
    },
  });
  if (!row || !row.imageBytes || !row.imageMime) return null;
  if (!row.published && !opts.allowUnpublished) return null;
  return {
    data: Buffer.from(row.imageBytes),
    mime: row.imageMime,
    updatedAt: row.updatedAt,
  };
}

export async function createNewsPost(
  input: NewsWriteInput,
  createdBy: string,
): Promise<NewsPostDto> {
  const fields = normalizeWrite(input);
  const image = imageUpdate(input);
  const now = new Date();
  const row = await prisma.newsPost.create({
    data: {
      title: fields.title,
      body: fields.body,
      published: fields.published,
      pinned: fields.pinned,
      createdBy,
      publishedAt: fields.published ? now : null,
      ...image,
    },
    select: LIST_SELECT,
  });
  const dto = serialize(row, { forAdmin: true });
  await maybeNotify({
    notify: input.notify,
    published: fields.published,
    post: dto,
    createdBy,
  });
  return dto;
}

export async function updateNewsPost(
  id: string,
  input: NewsWriteInput,
  updatedBy: string,
): Promise<NewsPostDto> {
  const existing = await prisma.newsPost.findUnique({
    where: { id },
    select: { id: true, published: true, publishedAt: true },
  });
  if (!existing) throw new NewsError("News post not found", "NOT_FOUND");

  const fields = normalizeWrite(input);
  const image = imageUpdate(input);
  const now = new Date();
  const becomingPublished = fields.published && !existing.published;
  const row = await prisma.newsPost.update({
    where: { id },
    data: {
      title: fields.title,
      body: fields.body,
      published: fields.published,
      pinned: fields.pinned,
      publishedAt: fields.published
        ? becomingPublished || existing.publishedAt == null
          ? now
          : existing.publishedAt
        : existing.publishedAt,
      ...image,
    },
    select: LIST_SELECT,
  });
  const dto = serialize(row, { forAdmin: true });
  await maybeNotify({
    notify: input.notify,
    published: fields.published,
    post: dto,
    createdBy: updatedBy,
  });
  return dto;
}

export async function deleteNewsPost(id: string): Promise<void> {
  try {
    await prisma.newsPost.delete({ where: { id } });
  } catch {
    throw new NewsError("News post not found", "NOT_FOUND");
  }
}

export { NewsImageError };
