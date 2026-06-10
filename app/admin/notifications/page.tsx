"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { SendNotificationForm } from "@/components/admin/send-notification-form";
import { useI18n } from "@/lib/i18n/context";

export default function AdminNotificationsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.notifications.title")}
        subtitle={t("admin.notifications.subtitle")}
      />
      <SendNotificationForm />
    </div>
  );
}
