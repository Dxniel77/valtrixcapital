import type { AppNotification, NotificationKind } from "@/lib/notifications/store";
import { useNotificationsStore } from "@/lib/notifications/store";

export type NotificationEvent =
  | "deposit_confirmed"
  | "withdrawal_requested"
  | "withdrawal_completed"
  | "daily_yield"
  | "referral_milestone";

const DEDUPE_MS = 60_000;
const recentKeys = new Map<string, number>();

function makeId() {
  return `ntf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function shouldDedupe(key: string): boolean {
  const now = Date.now();
  const last = recentKeys.get(key);
  if (last && now - last < DEDUPE_MS) return true;
  recentKeys.set(key, now);
  return false;
}

export function pushNotification(
  input: Omit<AppNotification, "id" | "read" | "createdAt"> & {
    dedupeKey?: string;
  },
): void {
  if (input.dedupeKey && shouldDedupe(input.dedupeKey)) return;

  const item: AppNotification = {
    ...input,
    id: makeId(),
    read: false,
    createdAt: Date.now(),
  };

  useNotificationsStore.setState((s) => ({
    items: [item, ...s.items].slice(0, 100),
  }));

  void queueEmailDigest(input);
}

async function queueEmailDigest(
  input: Pick<AppNotification, "title" | "body" | "kind"> & {
    dedupeKey?: string;
  },
) {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/notifications/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: input.title,
        body: input.body,
        kind: input.kind,
        dedupeKey: input.dedupeKey,
      }),
    });
  } catch {
    /* demo: email queue is best-effort */
  }
}

export function kindForEvent(event: NotificationEvent): NotificationKind {
  if (event === "referral_milestone") return "promo";
  if (event === "withdrawal_requested") return "alert";
  return "system";
}
