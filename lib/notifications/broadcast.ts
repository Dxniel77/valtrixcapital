import type { NotificationKind } from "@/lib/notifications/store";
import { pushNotification } from "@/lib/notifications/push";

export interface NotificationBroadcast {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  createdAt: number;
  createdBy: string;
}

const BROADCAST_KEY = "valtrix.notification.broadcasts";

function makeId(): string {
  return `bc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function loadBroadcasts(): NotificationBroadcast[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BROADCAST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as NotificationBroadcast[];
  } catch {
    return [];
  }
}

function saveBroadcasts(items: NotificationBroadcast[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BROADCAST_KEY, JSON.stringify(items));
}

export function publishBroadcast(
  input: Omit<NotificationBroadcast, "id" | "createdAt">,
): NotificationBroadcast {
  const broadcast: NotificationBroadcast = {
    ...input,
    id: makeId(),
    createdAt: Date.now(),
  };
  saveBroadcasts([broadcast, ...loadBroadcasts()].slice(0, 50));
  return broadcast;
}

/** Deliver platform-wide admin broadcasts into the user's notification inbox. */
export function syncBroadcastNotifications(): void {
  for (const broadcast of loadBroadcasts()) {
    pushNotification({
      kind: broadcast.kind,
      title: broadcast.title,
      body: broadcast.body,
      href: broadcast.href,
      dedupeKey: `broadcast_${broadcast.id}`,
    });
  }
}
