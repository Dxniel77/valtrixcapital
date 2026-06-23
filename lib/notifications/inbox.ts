import type { InboxNotificationDto } from "@/lib/services/inbox-notifications";
import { pushNotification } from "@/lib/notifications/push";
import { useNotificationsStore } from "@/lib/notifications/store";
import { translate, type Messages } from "@/lib/i18n";

function isBlankText(value: string | undefined): boolean {
  return !value?.trim();
}

function localizeInboxItem(
  item: InboxNotificationDto,
  messages: Messages,
): { title: string; body: string } | null {
  const titleKey = `notifications.events.${item.eventKey}Title`;
  const bodyKey = `notifications.events.${item.eventKey}Body`;
  const translatedTitle = translate(messages, titleKey, item.params);
  const translatedBody = translate(messages, bodyKey, item.params);

  const title =
    translatedTitle !== titleKey
      ? translatedTitle
      : item.params.title?.trim() || "";

  let body =
    translatedBody !== bodyKey
      ? translatedBody
      : item.params.body?.trim() || "";

  if (!body && item.params.preview?.trim()) {
    body = item.params.preview.trim();
  }

  if (!title) return null;
  if (!body) return null;
  return { title, body };
}

export function deliverInboxNotification(
  item: InboxNotificationDto,
  messages: Messages,
): void {
  const localized = localizeInboxItem(item, messages);
  if (!localized) return;

  const items = useNotificationsStore.getState().items;
  const existing = items.find((n) => n.dedupeKey === item.dedupeKey);
  if (existing) {
    const needsPatch =
      isBlankText(existing.title) || isBlankText(existing.body);
    if (!needsPatch) return;

    useNotificationsStore.setState((s) => ({
      items: s.items.map((n) =>
        n.dedupeKey === item.dedupeKey
          ? {
              ...n,
              kind: item.kind,
              title: localized.title,
              body: localized.body,
              href: item.href ?? n.href,
            }
          : n,
      ),
    }));
    return;
  }

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
