"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { SupportTicketForm } from "@/components/support/ticket-form";
import { SupportEmailChannel } from "@/components/support/support-email-channel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy } from "lucide-react";
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
          <SupportTicketForm />
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
