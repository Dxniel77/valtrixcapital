"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { useI18n } from "@/lib/i18n/context";

export default function WalletPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.pages.wallet.title")}
        subtitle={t("dashboard.pages.wallet.subtitle")}
      />
      <ComingSoon
        week={3}
        title={t("dashboard.pages.wallet.comingTitle")}
        description={t("dashboard.pages.wallet.comingDesc")}
      />
    </div>
  );
}
