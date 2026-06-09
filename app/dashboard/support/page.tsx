"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { SupportTicketForm } from "@/components/support/ticket-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LifeBuoy,
  Mail,
  MessageCircle,
  Send,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import {
  SUPPORT_EMAIL,
  SUPPORT_TELEGRAM_URL,
  SUPPORT_WHATSAPP_DISPLAY,
  SUPPORT_WHATSAPP_URL,
} from "@/lib/support/constants";

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
          <QuickChannel
            icon={Send}
            title={t("supportPage.telegram")}
            desc={t("supportPage.telegramDesc")}
            cta={t("supportPage.openTelegram")}
            href={SUPPORT_TELEGRAM_URL}
            accent="info"
          />
          <QuickChannel
            icon={MessageCircle}
            title={t("supportPage.whatsapp")}
            desc={t("supportPage.whatsappDesc", { phone: SUPPORT_WHATSAPP_DISPLAY })}
            cta={t("supportPage.openWhatsapp")}
            href={SUPPORT_WHATSAPP_URL}
            accent="success"
          />
          <QuickChannel
            icon={Mail}
            title={t("dashboard.pages.support.email")}
            desc={t("dashboard.pages.support.emailDesc")}
            cta={SUPPORT_EMAIL}
            href={`mailto:${SUPPORT_EMAIL}`}
          />
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

function QuickChannel({
  icon: Icon,
  title,
  desc,
  cta,
  href,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  cta: string;
  href: string;
  accent?: "info" | "success";
}) {
  return (
    <Card className="transition-colors hover:border-border-strong">
      <CardContent className="flex items-start gap-3 p-4">
        <span
          className={
            accent === "success"
              ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-success/30 bg-success/10 text-success"
              : accent === "info"
                ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-info/30 bg-info/10 text-info"
                : "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-hover text-gold"
          }
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-primary">{title}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{desc}</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <a href={href} target="_blank" rel="noopener noreferrer">
              {cta}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
