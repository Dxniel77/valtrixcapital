"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
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
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("admin.support.loading")}
          </div>
        }
      >
        <SupportTicketsPanel />
      </Suspense>
    </div>
  );
}
