import type { InboxAudience } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { NotificationKind } from "@/lib/notifications/store";
import { findUserByWallet } from "@/lib/services/users";
import { normalizeWallet } from "@/lib/auth/admins";

export interface InboxNotificationDto {
  id: string;
  kind: NotificationKind;
  eventKey: string;
  params: Record<string, string>;
  href?: string;
  dedupeKey: string;
  createdAt: number;
}

function serializeInbox(row: {
  id: string;
  kind: string;
  eventKey: string;
  params: unknown;
  href: string | null;
  dedupeKey: string;
  createdAt: Date;
}): InboxNotificationDto {
  const params =
    row.params && typeof row.params === "object" && !Array.isArray(row.params)
      ? Object.fromEntries(
          Object.entries(row.params as Record<string, unknown>).map(([k, v]) => [
            k,
            String(v ?? ""),
          ]),
        )
      : {};

  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    eventKey: row.eventKey,
    params,
    href: row.href ?? undefined,
    dedupeKey: row.dedupeKey,
    createdAt: row.createdAt.getTime(),
  };
}

export async function createInboxNotification(input: {
  audience: InboxAudience;
  userId?: string | null;
  wallet?: string | null;
  email?: string | null;
  kind: NotificationKind;
  eventKey: string;
  params?: Record<string, string | number>;
  href?: string;
  dedupeKey: string;
}): Promise<InboxNotificationDto | null> {
  const wallet = input.wallet?.trim()
    ? normalizeWallet(input.wallet.trim())
    : null;
  const email = input.email?.trim().toLowerCase() || null;

  try {
    const row = await prisma.inboxNotification.create({
      data: {
        audience: input.audience,
        userId: input.userId ?? null,
        wallet,
        email,
        kind: input.kind,
        eventKey: input.eventKey,
        params: input.params ?? {},
        href: input.href ?? null,
        dedupeKey: input.dedupeKey,
      },
    });
    return serializeInbox(row);
  } catch {
    return null;
  }
}

export async function listInboxNotificationsForSession(input: {
  role: "USER" | "ADMIN";
  address: string;
  dbUserId?: string | null;
  since?: number;
  limit?: number;
}): Promise<InboxNotificationDto[]> {
  const since = input.since ?? 0;
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const createdAtFilter =
    since > 0 ? { createdAt: { gt: new Date(since) } } : undefined;

  if (input.role === "ADMIN") {
    const rows = await prisma.inboxNotification.findMany({
      where: {
        audience: "ADMIN",
        ...createdAtFilter,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(serializeInbox);
  }

  const wallet = normalizeWallet(input.address);
  const user =
    input.dbUserId
      ? await prisma.user.findUnique({ where: { id: input.dbUserId } })
      : await findUserByWallet(wallet);

  const orFilters: Array<Record<string, string>> = [{ wallet }];
  if (user?.id) orFilters.push({ userId: user.id });
  if (user?.email) orFilters.push({ email: user.email.toLowerCase() });

  const rows = await prisma.inboxNotification.findMany({
    where: {
      audience: "USER",
      OR: orFilters,
      ...createdAtFilter,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map(serializeInbox);
}

export async function resolveUserIdForTicket(input: {
  wallet?: string | null;
  email: string;
}): Promise<string | null> {
  if (input.wallet?.trim()) {
    const byWallet = await findUserByWallet(input.wallet.trim());
    if (byWallet) return byWallet.id;
  }

  const email = input.email.trim().toLowerCase();
  const byEmail = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  return byEmail?.id ?? null;
}
