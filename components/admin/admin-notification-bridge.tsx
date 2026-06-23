"use client";

import * as React from "react";
import { useI18n } from "@/lib/i18n/context";
import { syncInboxNotificationsFromServer } from "@/lib/notifications/inbox";
import { usePageVisible } from "@/lib/hooks/use-page-visible";

/** Polls server inbox for admin-targeted alerts (e.g. new support tickets). */
export function AdminNotificationBridge() {
  const { messages } = useI18n();
  const visible = usePageVisible();

  React.useEffect(() => {
    if (!visible) return;

    void syncInboxNotificationsFromServer(messages);
    const poll = window.setInterval(() => {
      void syncInboxNotificationsFromServer(messages);
    }, 45_000);

    return () => window.clearInterval(poll);
  }, [visible, messages]);

  return null;
}
