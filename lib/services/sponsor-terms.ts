import type { SponsorTermsStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface SponsorTermsVersionDto {
  id: string;
  version: number;
  title: string;
  content: string;
  status: SponsorTermsStatus;
  effectiveAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  acceptanceCount?: number;
}

export interface SponsorTermsAcceptanceDto {
  id: string;
  userId: string;
  walletAddress: string;
  username: string | null;
  termsVersionId: number;
  termsTitle: string;
  acceptedAt: string;
  ipAddress: string | null;
}

function serializeVersion(
  row: {
    id: string;
    version: number;
    title: string;
    content: string;
    status: SponsorTermsStatus;
    effectiveAt: Date | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    _count?: { acceptances: number };
  },
): SponsorTermsVersionDto {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    content: row.content,
    status: row.status,
    effectiveAt: row.effectiveAt?.toISOString() ?? null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    acceptanceCount: row._count?.acceptances,
  };
}

export async function listSponsorTermsVersions(): Promise<SponsorTermsVersionDto[]> {
  const rows = await prisma.sponsorTermsVersion.findMany({
    orderBy: { version: "desc" },
    include: { _count: { select: { acceptances: true } } },
  });
  return rows.map(serializeVersion);
}

export async function getActiveSponsorTerms(): Promise<SponsorTermsVersionDto | null> {
  const row = await prisma.sponsorTermsVersion.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
  });
  return row ? serializeVersion(row) : null;
}

export async function getPendingTermsForUser(
  userId: string,
): Promise<SponsorTermsVersionDto | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountGranted: true },
  });
  if (!user?.accountGranted) return null;

  const active = await prisma.sponsorTermsVersion.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
  });
  if (!active) return null;

  const accepted = await prisma.sponsorTermsAcceptance.findUnique({
    where: {
      userId_termsVersionId: { userId, termsVersionId: active.id },
    },
  });
  if (accepted) return null;

  return serializeVersion(active);
}

export async function createSponsorTermsVersion(input: {
  adminId: string;
  title: string;
  content: string;
  publish?: boolean;
}): Promise<SponsorTermsVersionDto> {
  const maxVersion = await prisma.sponsorTermsVersion.aggregate({
    _max: { version: true },
  });
  const nextVersion = (maxVersion._max.version ?? 0) + 1;

  return prisma.$transaction(async (tx) => {
    if (input.publish) {
      await tx.sponsorTermsVersion.updateMany({
        where: { status: "ACTIVE" },
        data: { status: "ARCHIVED" },
      });
    }

    const row = await tx.sponsorTermsVersion.create({
      data: {
        version: nextVersion,
        title: input.title.trim(),
        content: input.content.trim(),
        status: input.publish ? "ACTIVE" : "DRAFT",
        effectiveAt: input.publish ? new Date() : null,
        createdById: input.adminId,
      },
    });

    await tx.adminAction.create({
      data: {
        adminId: input.adminId,
        action: "UPDATE_SPONSOR_TERMS",
        payload: {
          action: "create",
          versionId: row.id,
          version: row.version,
          published: !!input.publish,
        },
      },
    });

    return serializeVersion(row);
  });
}

export async function updateSponsorTermsVersion(input: {
  adminId: string;
  id: string;
  title?: string;
  content?: string;
}): Promise<SponsorTermsVersionDto> {
  const existing = await prisma.sponsorTermsVersion.findUnique({
    where: { id: input.id },
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.status === "ARCHIVED") throw new Error("ARCHIVED");

  const row = await prisma.sponsorTermsVersion.update({
    where: { id: input.id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.content !== undefined ? { content: input.content.trim() } : {}),
    },
  });

  await prisma.adminAction.create({
    data: {
      adminId: input.adminId,
      action: "UPDATE_SPONSOR_TERMS",
      payload: { action: "update", versionId: row.id, version: row.version },
    },
  });

  return serializeVersion(row);
}

export async function publishSponsorTermsVersion(input: {
  adminId: string;
  id: string;
}): Promise<SponsorTermsVersionDto> {
  const existing = await prisma.sponsorTermsVersion.findUnique({
    where: { id: input.id },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    await tx.sponsorTermsVersion.updateMany({
      where: { status: "ACTIVE", NOT: { id: input.id } },
      data: { status: "ARCHIVED" },
    });

    const row = await tx.sponsorTermsVersion.update({
      where: { id: input.id },
      data: { status: "ACTIVE", effectiveAt: new Date() },
    });

    await tx.adminAction.create({
      data: {
        adminId: input.adminId,
        action: "UPDATE_SPONSOR_TERMS",
        payload: { action: "publish", versionId: row.id, version: row.version },
      },
    });

    return serializeVersion(row);
  });
}

export async function acceptSponsorTerms(input: {
  userId: string;
  termsVersionId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const terms = await prisma.sponsorTermsVersion.findUnique({
    where: { id: input.termsVersionId },
  });
  if (!terms || terms.status !== "ACTIVE") throw new Error("INVALID_TERMS");

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { accountGranted: true },
  });
  if (!user?.accountGranted) throw new Error("NOT_SPONSORED");

  await prisma.sponsorTermsAcceptance.upsert({
    where: {
      userId_termsVersionId: {
        userId: input.userId,
        termsVersionId: input.termsVersionId,
      },
    },
    create: {
      userId: input.userId,
      termsVersionId: input.termsVersionId,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
    update: {
      acceptedAt: new Date(),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function listTermsAcceptances(
  termsVersionId?: string,
): Promise<SponsorTermsAcceptanceDto[]> {
  const rows = await prisma.sponsorTermsAcceptance.findMany({
    where: termsVersionId ? { termsVersionId } : undefined,
    orderBy: { acceptedAt: "desc" },
    take: 200,
    include: {
      user: { select: { walletAddress: true, username: true } },
      termsVersion: { select: { version: true, title: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    walletAddress: row.user.walletAddress,
    username: row.user.username,
    termsVersionId: row.termsVersion.version,
    termsTitle: row.termsVersion.title,
    acceptedAt: row.acceptedAt.toISOString(),
    ipAddress: row.ipAddress,
  }));
}
