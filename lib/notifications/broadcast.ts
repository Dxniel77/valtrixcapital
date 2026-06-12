import type { NotificationBroadcast } from "@/lib/notifications/broadcast-types";
import { pushNotification } from "@/lib/notifications/push";

export type { NotificationBroadcast } from "@/lib/notifications/broadcast-types";

/** Push one server broadcast into the user's local notification inbox. */
export function deliverBroadcast(broadcast: NotificationBroadcast): void {
  pushNotification({
    kind: broadcast.kind,
    title: broadcast.title,
    body: broadcast.body,
    href: broadcast.href,
    dedupeKey: `broadcast_${broadcast.id}`,
  });
}

export function deliverBroadcasts(broadcasts: NotificationBroadcast[]): void {
  for (const broadcast of broadcasts) {
    deliverBroadcast(broadcast);
  }
}

export async function fetchBroadcastsSince(
  since = 0,
): Promise<NotificationBroadcast[]> {
  if (typeof window === "undefined") return [];
  try {
    const res = await fetch(
      `/api/notifications/broadcasts?since=${Math.max(0, since)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { broadcasts?: NotificationBroadcast[] };
    return data.broadcasts ?? [];
  } catch {
    return [];
  }
}

/** Fetch all server broadcasts and deliver any missing ones to the inbox. */
export async function syncBroadcastNotificationsFromServer(): Promise<void> {
  const broadcasts = await fetchBroadcastsSince(0);
  deliverBroadcasts(broadcasts);
}

export async function publishBroadcastToServer(input: {
  kind: NotificationBroadcast["kind"];
  title: string;
  body: string;
  href?: string;
}): Promise<NotificationBroadcast | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/notifications/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { broadcast?: NotificationBroadcast };
    return data.broadcast ?? null;
  } catch {
    return null;
  }
}

export async function loadRecentBroadcasts(
  limit = 8,
): Promise<NotificationBroadcast[]> {
  const broadcasts = await fetchBroadcastsSince(0);
  return broadcasts.slice(0, limit);
}
