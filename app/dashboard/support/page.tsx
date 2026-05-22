"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LifeBuoy, MessagesSquare, Mail, Telescope } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";

export default function SupportPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.pages.support.title")}
        subtitle={t("dashboard.pages.support.subtitle")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SupportCard
          icon={MessagesSquare}
          title={t("dashboard.pages.support.liveChat")}
          desc={t("dashboard.pages.support.liveChatDesc")}
          cta={t("dashboard.pages.support.openChat")}
          coming
        />
        <SupportCard
          icon={Mail}
          title={t("dashboard.pages.support.email")}
          desc={t("dashboard.pages.support.emailDesc")}
          cta="support@valtrix.capital"
          href="mailto:support@valtrix.capital"
        />
        <SupportCard
          icon={Telescope}
          title={t("dashboard.pages.support.docs")}
          desc={t("dashboard.pages.support.docsDesc")}
          cta={t("dashboard.pages.support.browseDocs")}
          coming
        />
        <SupportCard
          icon={LifeBuoy}
          title={t("dashboard.pages.support.status")}
          desc={t("dashboard.pages.support.statusDesc")}
          cta={t("dashboard.pages.support.viewStatus")}
          coming
        />
      </div>
    </div>
  );
}

function SupportCard({
  icon: Icon,
  title,
  desc,
  cta,
  href,
  coming,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  cta: string;
  href?: string;
  coming?: boolean;
}) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border-subtle bg-bg-hover text-gold">
            <Icon className="h-5 w-5" />
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-secondary">{desc}</p>
        <div className="mt-4">
          {href ? (
            <Button asChild variant="outline" size="sm">
              <a href={href}>{cta}</a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={coming}>
              {coming ? t("common.comingSoon") : cta}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
