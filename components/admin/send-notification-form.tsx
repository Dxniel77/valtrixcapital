"use client";

import * as React from "react";
import { toast } from "sonner";
import { Bell, Megaphone, Send, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import {
  loadRecentBroadcasts,
  publishBroadcastToServer,
  type NotificationBroadcast,
} from "@/lib/notifications/broadcast";
import type { NotificationKind } from "@/lib/notifications/store";
import { cn } from "@/lib/utils";

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const KINDS: NotificationKind[] = ["alert", "promo", "system"];

const KIND_ICON = {
  alert: ShieldAlert,
  promo: Megaphone,
  system: Bell,
} as const;

export function SendNotificationForm() {
  const { t } = useI18n();
  const [kind, setKind] = React.useState<NotificationKind>("promo");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [href, setHref] = React.useState("");
  const [recent, setRecent] = React.useState<NotificationBroadcast[]>([]);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    void loadRecentBroadcasts(8).then(setRecent);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      toast.error(t("admin.notifications.validation"));
      return;
    }

    setSending(true);
    try {
      const broadcast = await publishBroadcastToServer({
        kind,
        title: trimmedTitle,
        body: trimmedBody,
        href: href.trim() || undefined,
      });

      if (!broadcast) {
        toast.error(t("admin.notifications.sendFailed"));
        return;
      }

      toast.success(t("admin.notifications.sent"));
      setTitle("");
      setBody("");
      setHref("");
      setRecent((prev) => [broadcast, ...prev.filter((b) => b.id !== broadcast.id)].slice(0, 8));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.notifications.composeTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-text-muted">
                {t("admin.notifications.kindLabel")}
              </label>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => {
                  const Icon = KIND_ICON[k];
                  const active = kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-gold/40 bg-gold/10 text-gold"
                          : "border-border-subtle bg-bg-base/50 text-text-secondary hover:border-border-strong",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t(`notifications.kind.${k}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-text-muted">
                {t("admin.notifications.titleLabel")}
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("admin.notifications.titlePlaceholder")}
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-text-muted">
                {t("admin.notifications.bodyLabel")}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("admin.notifications.bodyPlaceholder")}
                maxLength={500}
                rows={4}
                className="w-full rounded-md border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-gold/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-text-muted">
                {t("admin.notifications.linkLabel")}
              </label>
              <Input
                value={href}
                onChange={(e) => setHref(e.target.value)}
                placeholder="/dashboard/trade"
              />
            </div>

            <Button type="submit" className="gap-2" disabled={sending}>
              <Send className="h-4 w-4" />
              {sending ? t("admin.notifications.sending") : t("admin.notifications.send")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("admin.notifications.recentTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-text-muted">
              {t("admin.notifications.recentEmpty")}
            </p>
          ) : (
            <ul className="space-y-3">
              {recent.map((item) => {
                const Icon = KIND_ICON[item.kind];
                return (
                  <li
                    key={item.id}
                    className="rounded-md border border-border-subtle bg-bg-base/40 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-text-secondary">
                          {item.body}
                        </p>
                        <p className="mt-1 text-[10px] text-text-muted">
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
