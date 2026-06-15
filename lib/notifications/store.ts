"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { dedupeNotifications } from "@/lib/notifications/dedupe";

export type NotificationKind = "alert" | "promo" | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  href?: string;
  dedupeKey?: string;
}

interface NotificationsState {
  items: AppNotification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const DEMO_DEDUPE_KEYS = new Set([
  "demo_promo_active",
  "demo_share_earnings",
  "demo_yield_credited",
]);

function stripDemoNotifications(items: AppNotification[]): AppNotification[] {
  return items.filter((n) => !n.dedupeKey || !DEMO_DEDUPE_KEYS.has(n.dedupeKey));
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      items: [],

      markRead: (id) =>
        set((s) => ({
          items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),

      markAllRead: () =>
        set((s) => ({
          items: s.items.map((n) => ({ ...n, read: true })),
        })),
    }),
    {
      name: "valtrix.notifications.v2",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : window.localStorage,
      ),
      partialize: (s) => ({ items: s.items }),
      migrate: (persisted, version) => {
        const prev = persisted as { items?: AppNotification[] };
        let items = dedupeNotifications(prev.items ?? []);
        if (version < 3) {
          items = stripDemoNotifications(items);
        }
        return { items };
      },
      version: 3,
    },
  ),
);

export function useUnreadNotificationCount(): number {
  return useNotificationsStore((s) => s.items.filter((n) => !n.read).length);
}

export function useNotificationsHydrated(): boolean {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const unsub = useNotificationsStore.persist.onFinishHydration(() =>
      setReady(true),
    );
    if (useNotificationsStore.persist.hasHydrated()) setReady(true);
    return unsub;
  }, []);
  return ready;
}
