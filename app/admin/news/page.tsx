"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { AdminNewsPanel } from "@/components/admin/admin-news-panel";
import { useI18n } from "@/lib/i18n/context";

export default function AdminNewsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.news.title")}
        subtitle={t("admin.news.subtitle")}
      />
      <AdminNewsPanel />
    </div>
  );
}
