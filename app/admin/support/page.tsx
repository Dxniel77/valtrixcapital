"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { SupportTicketsPanel } from "@/components/admin/support-tickets-panel";
import { useI18n } from "@/lib/i18n/context";

export default function AdminSupportPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.support.title")}
        subtitle={t("admin.support.subtitle")}
      />
      <SupportTicketsPanel />
    </div>
  );
}
