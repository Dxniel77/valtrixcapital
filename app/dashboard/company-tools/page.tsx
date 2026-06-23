"use client";

import * as React from "react";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, Cpu } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { CompanyRevenueSummary } from "@/components/dashboard/company-tools/company-revenue-summary";
import {
  CompanyToolsPageSkeleton,
  CompanyToolsPanelSkeleton,
} from "@/components/dashboard/company-tools/company-tools-skeleton";
import { useI18n } from "@/lib/i18n/context";
import { startNavigationProgress } from "@/lib/navigation/progress-events";
import { cn } from "@/lib/utils";

const BotTradingPanel = dynamic(
  () =>
    import("@/components/dashboard/company-tools/bot-trading-panel").then(
      (mod) => mod.BotTradingPanel,
    ),
  { loading: () => <CompanyToolsPanelSkeleton /> },
);

const LiquidationEnginePanel = dynamic(
  () =>
    import("@/components/dashboard/company-tools/liquidation-engine-panel").then(
      (mod) => mod.LiquidationEnginePanel,
    ),
  { loading: () => <CompanyToolsPanelSkeleton /> },
);

type CompanyToolsTab = "bot" | "liquidation";

function parseTab(value: string | null): CompanyToolsTab {
  return value === "liquidation" ? "liquidation" : "bot";
}

function CompanyToolsContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  function selectTab(next: CompanyToolsTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "bot") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const query = params.toString();
    startNavigationProgress();
    router.replace(
      query ? `/dashboard/company-tools?${query}` : "/dashboard/company-tools",
      { scroll: false },
    );
  }

  const tabs: {
    id: CompanyToolsTab;
    label: string;
    icon: typeof Bot;
  }[] = [
    { id: "bot", label: t("companyToolsPage.tabBot"), icon: Bot },
    {
      id: "liquidation",
      label: t("companyToolsPage.tabLiquidation"),
      icon: Cpu,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("companyToolsPage.title")}
        subtitle={t("companyToolsPage.subtitle")}
      />

      <CompanyRevenueSummary />

      <div
        role="tablist"
        aria-label={t("companyToolsPage.title")}
        className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border-subtle bg-bg-base/60 p-1"
      >
        {tabs.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(item.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-gold/15 text-gold shadow-sm"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {tab === "bot" ? <BotTradingPanel /> : <LiquidationEnginePanel />}
      </div>
    </div>
  );
}

export default function CompanyToolsPage() {
  return (
    <Suspense fallback={<CompanyToolsPageSkeleton />}>
      <CompanyToolsContent />
    </Suspense>
  );
}
