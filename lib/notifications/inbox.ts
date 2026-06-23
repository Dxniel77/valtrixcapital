import type { InboxNotificationDto } from "@/lib/services/inbox-notifications";
import { pushNotification } from "@/lib/notifications/push";
import { translate, type Messages } from "@/lib/i18n";

function localizeInboxItem(
  item: InboxNotificationDto,
  messages: Messages,
): { title: string; body: string } | null {
  const titleKey = `notifications.events.${item.eventKey}Title`;
  const bodyKey = `notifications.events.${item.eventKey}Body`;
  const title = translate(messages, titleKey, item.params);
  const body = translate(messages, bodyKey, item.params);

  if (title === titleKey || body === bodyKey) return null;
  return { title, body };
}

export function deliverInboxNotification(
  item: InboxNotificationDto,
  messages: Messages,
): void {
  const localized = localizeInboxItem(item, messages);
  if (!localized) return;

  pushNotification({
    kind: item.kind,
    title: localized.title,
    body: localized.body,
    href: item.href,
    dedupeKey: item.dedupeKey,
    skipEmail: true,
  });
}

export function deliverInboxNotifications(
  items: InboxNotificationDto[],
  messages: Messages,
): void {
  for (const item of items) {
    deliverInboxNotification(item, messages);
  }
}

export async function fetchInboxNotificationsSince(
  since = 0,
): Promise<InboxNotificationDto[]> {
  if (typeof window === "undefined") return [];
  try {
    const res = await fetch(
      `/api/notifications/inbox?since=${Math.max(0, since)}`,
      { cache: "no-store", credentials: "include" },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      notifications?: InboxNotificationDto[];
    };
    return data.notifications ?? [];
  } catch {
    return [];
  }
}

export async function syncInboxNotificationsFromServer(
  messages: Messages,
): Promise<void> {
  const notifications = await fetchInboxNotificationsSince(0);
  deliverInboxNotifications(notifications, messages);
}
