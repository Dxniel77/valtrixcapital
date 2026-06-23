"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SupportEmailChannel } from "@/components/support/support-email-channel";
import { UserSupportTicketsPanel } from "@/components/support/user-support-tickets-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";

export default function SupportPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.pages.support.title")}
        subtitle={t("supportPage.subtitle")}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Suspense
            fallback={
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("supportPage.loading")}
              </div>
            }
          >
            <UserSupportTicketsPanel />
          </Suspense>
        </div>

        <div className="space-y-4">
          <SupportEmailChannel />
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-gold" />
                <CardTitle className="text-sm">
                  {t("supportPage.hoursTitle")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed text-text-secondary">
              {t("supportPage.hoursDesc")}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
