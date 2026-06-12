import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import type { NotificationKind } from "@/lib/notifications/store";
import type { NotificationBroadcast } from "@/lib/notifications/broadcast-types";
import {
  emitBroadcast,
  listMemoryBroadcasts,
  rememberBroadcast,
} from "@/lib/notifications/broadcast-events";

function toBroadcast(row: {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  createdBy: string;
  createdAt: Date;
}): NotificationBroadcast {
  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body,
    href: row.href ?? undefined,
    createdBy: row.createdBy,
    createdAt: row.createdAt.getTime(),
  };
}

async function loadFromDatabase(
  since = 0,
  limit = 50,
): Promise<NotificationBroadcast[] | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const rows = await prisma.platformBroadcast.findMany({
      where: since > 0 ? { createdAt: { gt: new Date(since) } } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toBroadcast);
  } catch {
    return null;
  }
}

async function saveToDatabase(
  broadcast: NotificationBroadcast,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.platformBroadcast.create({
      data: {
        id: broadcast.id,
        kind: broadcast.kind,
        title: broadcast.title,
        body: broadcast.body,
        href: broadcast.href ?? null,
        createdBy: broadcast.createdBy,
        createdAt: new Date(broadcast.createdAt),
      },
    });
  } catch {
    /* DB may be unavailable — in-memory delivery still works */
  }
}

export async function listBroadcasts(
  since = 0,
  limit = 50,
): Promise<NotificationBroadcast[]> {
  const fromDb = await loadFromDatabase(since, limit);
  if (fromDb) return fromDb;

  const fromMemory = listMemoryBroadcasts(since);
  return fromMemory.slice(0, limit);
}

export async function publishPlatformBroadcast(input: {
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  createdBy: string;
}): Promise<NotificationBroadcast> {
  const broadcast: NotificationBroadcast = {
    id: randomUUID(),
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href,
    createdBy: input.createdBy,
    createdAt: Date.now(),
  };

  rememberBroadcast(broadcast);
  await saveToDatabase(broadcast);
  emitBroadcast(broadcast);
  return broadcast;
}
