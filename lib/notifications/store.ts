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
  seedIfEmpty: () => void;
}

const DEMO: Omit<AppNotification, "id">[] = [
  {
    kind: "alert",
    title: "Nueva promoción activa",
    body: "Bono extra por victorias en operaciones hasta el viernes.",
    createdAt: Date.now() - 3_600_000,
    read: false,
    href: "/dashboard/trade",
    dedupeKey: "demo_promo_active",
  },
  {
    kind: "promo",
    title: "Comparte tus ganancias",
    body: "Descarga tu imagen de rendimientos desde 1 día hasta 3 meses.",
    createdAt: Date.now() - 86_400_000,
    read: false,
    href: "/dashboard/share",
    dedupeKey: "demo_share_earnings",
  },
  {
    kind: "system",
    title: "Rendimiento acreditado",
    body: "Tu rendimiento pasivo de ayer ya está en tu saldo.",
    createdAt: Date.now() - 172_800_000,
    read: true,
    dedupeKey: "demo_yield_credited",
  },
];

function makeId() {
  return `ntf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],

      markRead: (id) =>
        set((s) => ({
          items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),

      markAllRead: () =>
        set((s) => ({
          items: s.items.map((n) => ({ ...n, read: true })),
        })),

      seedIfEmpty: () => {
        if (get().items.length > 0) return;
        set({
          items: DEMO.map((d) => ({ ...d, id: makeId() })),
        });
      },
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
      migrate: (persisted) => {
        const prev = persisted as { items?: AppNotification[] };
        const items = dedupeNotifications(prev.items ?? []);
        return { items };
      },
      version: 2,
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
