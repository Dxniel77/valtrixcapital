"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { SupportTicketForm } from "@/components/support/ticket-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { LifeBuoy, Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { SUPPORT_EMAIL } from "@/lib/support/constants";
import { cn } from "@/lib/utils";

const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  "Valtrix Capital - Support",
)}`;

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
            icon={Mail}
            title={t("dashboard.pages.support.email")}
            desc={t("dashboard.pages.support.emailDesc")}
            cta={SUPPORT_EMAIL}
            href={SUPPORT_MAILTO}
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  cta: string;
  href: string;
}) {
  const isMailto = href.startsWith("mailto:");
  const isTel = href.startsWith("tel:");
  const external = !isMailto && !isTel && /^https?:/i.test(href);

  return (
    <Card className="transition-colors hover:border-border-strong">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-hover text-gold">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-primary">{title}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{desc}</p>
          <a
            href={href}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-3",
            )}
            {...(external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            onClick={
              isMailto || isTel
                ? (event) => {
                    event.preventDefault();
                    window.location.assign(href);
                  }
                : undefined
            }
          >
            {cta}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
