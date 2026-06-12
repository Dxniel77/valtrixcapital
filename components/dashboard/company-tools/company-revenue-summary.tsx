"use client";

import * as React from "react";
import { Bot, Cpu, Layers } from "lucide-react";

import { useI18n } from "@/lib/i18n/context";
import { useCombinedEngineProfits, useLiveCombinedToday } from "@/lib/company-tools/combined-profits";
import { formatNumber } from "@/lib/utils";

export function CompanyRevenueSummary() {
  const { t } = useI18n();
  const profits = useCombinedEngineProfits();
  const liveToday = useLiveCombinedToday();

  const items = [
    {
      key: "today",
      label: t("companyToolsPage.revenueToday"),
      value: liveToday,
      decimals: 0,
    },
    {
      key: "week",
      label: t("companyToolsPage.revenueWeek"),
      value: profits.combinedWeek,
      decimals: 0,
    },
    {
      key: "all",
      label: t("companyToolsPage.revenueAllTime"),
      value: profits.combinedAllTime,
      decimals: 0,
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-gold/30 bg-gradient-to-r from-gold/10 via-bg-elevated to-info/5">
      <div className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gold/30 bg-gold/10 text-gold">
              <Layers className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wider text-gold">
                {t("companyToolsPage.revenueTitle")}
              </p>
              <p className="text-[11px] text-text-muted">
                {t("companyToolsPage.revenueHint")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {items.map((it) => (
              <div key={it.key} className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-text-muted">
                  {it.label}
                </p>
                <p className="font-mono text-base text-text-primary sm:text-lg">
                  ${formatNumber(it.value, { decimals: it.decimals })}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border-subtle bg-bg-base/50 px-3 py-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-text-secondary">
              <Bot className="h-3.5 w-3.5 text-gold" />
              {t("companyToolsPage.tabBot")}
            </div>
            <p className="font-mono text-sm text-text-primary">
              ${formatNumber(profits.botToday, { decimals: 0 })}{" "}
              <span className="text-xs text-text-muted">
                {t("companyToolsPage.revenueTodayShort")}
              </span>
            </p>
          </div>
          <div className="rounded-md border border-border-subtle bg-bg-base/50 px-3 py-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-text-secondary">
              <Cpu className="h-3.5 w-3.5 text-gold" />
              {t("companyToolsPage.tabLiquidation")}
            </div>
            <p className="font-mono text-sm text-text-primary">
              ${formatNumber(profits.liquidationTodayLive, { decimals: 2 })}{" "}
              <span className="text-xs text-text-muted">
                {t("companyToolsPage.revenueTodayShort")}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
