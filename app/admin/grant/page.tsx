"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { GrantAccountForm } from "@/components/admin/grant-account-form";
import { useI18n } from "@/lib/i18n/context";

export default function AdminGrantPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.grant.title")}
        subtitle={t("admin.grant.subtitle")}
      />
      <GrantAccountForm />
    </div>
  );
}
