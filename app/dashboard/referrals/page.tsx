"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { useI18n } from "@/lib/i18n/context";

export default function ReferralsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.pages.referrals.title")}
        subtitle={t("dashboard.pages.referrals.subtitle")}
      />
      <ComingSoon
        week={5}
        title={t("dashboard.pages.referrals.comingTitle")}
        description={t("dashboard.pages.referrals.comingDesc")}
      />
    </div>
  );
}
