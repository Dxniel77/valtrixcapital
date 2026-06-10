import type { AppNotification, NotificationKind } from "@/lib/notifications/store";

export function notificationDedupeKey(
  item: Pick<AppNotification, "dedupeKey" | "kind" | "title" | "body">,
): string {
  if (item.dedupeKey) return item.dedupeKey;
  return `${item.kind}:${item.title}:${item.body}`;
}

export function dedupeNotifications(items: AppNotification[]): AppNotification[] {
  const seen = new Set<string>();
  const out: AppNotification[] = [];
  for (const item of items) {
    const key = notificationDedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function hasNotificationInList(
  items: AppNotification[],
  input: {
    dedupeKey?: string;
    kind: NotificationKind;
    title: string;
    body: string;
  },
): boolean {
  const key = notificationDedupeKey(input);
  return items.some((n) => notificationDedupeKey(n) === key);
}
