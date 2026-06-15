"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Megaphone, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import {
  useNotificationsStore,
  useNotificationsHydrated,
  useUnreadNotificationCount,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications/store";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<NotificationKind, React.ElementType> = {
  alert: ShieldAlert,
  promo: Megaphone,
  system: Bell,
};

export function NotificationsPanel() {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const hydrated = useNotificationsHydrated();
  const unread = useUnreadNotificationCount();
  const items = useNotificationsStore((s) => s.items);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  function handleOpen() {
    setOpen(true);
  }

  function handleSelect(n: AppNotification) {
    markRead(n.id);
    if (n.href) setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t("dashboard.header.notifications")}
        className="relative rounded-md border border-border-subtle bg-bg-base p-2 text-text-secondary hover:border-border-strong hover:text-text-primary"
      >
        <Bell className="h-4 w-4" />
        {hydrated && unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-bg-base">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("notifications.title")}</DialogTitle>
            <DialogDescription>{t("notifications.subtitle")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-muted">
                {t("notifications.empty")}
              </p>
            ) : (
              items.map((n) => (
                <NotificationRow
                  key={n.id}
                  item={n}
                  onSelect={() => handleSelect(n)}
                />
              ))
            )}
          </DialogBody>
          {items.some((n) => !n.read) ? (
            <div className="shrink-0 border-t border-border-subtle px-4 py-3">
              <Button variant="ghost" size="sm" onClick={markAllRead} className="w-full">
                {t("notifications.markAllRead")}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function NotificationRow({
  item,
  onSelect,
}: {
  item: AppNotification;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const Icon = KIND_ICON[item.kind];
  const content = (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-3 transition-colors",
        item.read
          ? "border-border-subtle bg-bg-base/40"
          : "border-gold/25 bg-gold/5",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          item.kind === "alert" && "bg-danger/15 text-danger",
          item.kind === "promo" && "bg-gold/15 text-gold",
          item.kind === "system" && "bg-bg-hover text-text-secondary",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-text-primary">{item.title}</p>
          <span className="shrink-0 text-[10px] text-text-muted">
            {formatRelative(item.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">{item.body}</p>
        <span className="mt-1 inline-block text-[10px] uppercase tracking-wider text-text-muted">
          {t(`notifications.kind.${item.kind}`)}
        </span>
      </div>
    </div>
  );

  if (item.href) {
    return (
      <Link href={item.href} onClick={onSelect} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onSelect} className="block w-full text-left">
      {content}
    </button>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
