"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { useI18n } from "@/lib/i18n/context";

export default function BotTradingPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.pages.botTrading.title")}
        subtitle={t("dashboard.pages.botTrading.subtitle")}
      />
      <ComingSoon
        week={4}
        title={t("dashboard.pages.botTrading.comingTitle")}
        description={t("dashboard.pages.botTrading.comingDesc")}
      />
    </div>
  );
}
