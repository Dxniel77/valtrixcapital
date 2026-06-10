"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore } from "@/lib/admin/store";
import {
  billingPeriodTotal,
  computeTopPerformers,
  type LeaderPeriod,
} from "@/lib/admin/analytics";
import { exportLeadersCsv } from "@/lib/admin/exports";
import { cn, formatNumber, shortenAddress } from "@/lib/utils";

export default function AdminLeadersPage() {
  const { t } = useI18n();
  const users = useAdminStore((s) => s.users);
  const movements = useAdminStore((s) => s.movements);
  const [period, setPeriod] = React.useState<LeaderPeriod>("week");

  const rows = React.useMemo(
    () => computeTopPerformers(users, movements, period),
    [users, movements, period],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.leaders.title")}
        subtitle={t("admin.leaders.subtitle")}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportLeadersCsv(rows, period)}
          >
            <Download className="h-3.5 w-3.5" />
            {t("admin.leaders.export")}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["week", t("admin.leaders.week")],
            ["month", t("admin.leaders.month")],
            ["3months", t("admin.leaders.threeMonths")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              period === key
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-border-subtle text-text-secondary hover:text-text-primary",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Table>
        <thead>
          <THeadRow>
            <TH>#</TH>
            <TH>{t("admin.leaders.colUser")}</TH>
            <TH className="text-right">{t("admin.leaders.colTotal")}</TH>
            <TH className="text-right">{t("admin.leaders.colOperational")}</TH>
            <TH className="text-right">{t("admin.leaders.colNetwork")}</TH>
            <TH className="text-right">{t("admin.leaders.colPassive")}</TH>
            <TH className="text-right">L1–L8</TH>
          </THeadRow>
        </thead>
        <TBody>
          {rows.map((row, i) => (
            <TR key={row.user.id}>
              <TD>
                {i < 3 ? (
                  <Badge variant="gold">{i + 1}</Badge>
                ) : (
                  <span className="font-mono text-text-muted">{i + 1}</span>
                )}
              </TD>
              <TD>
                <p className="font-medium text-text-primary">{row.user.alias}</p>
                <p className="font-mono text-xs text-text-muted">
                  {shortenAddress(row.user.wallet)}
                </p>
              </TD>
              <TD className="text-right font-mono text-gold">
                ${formatNumber(billingPeriodTotal(row), { decimals: 0 })}
              </TD>
              <TD className="text-right font-mono text-text-secondary">
                ${formatNumber(row.operational, { decimals: 0 })}
              </TD>
              <TD className="text-right font-mono text-text-secondary">
                ${formatNumber(row.network, { decimals: 0 })}
              </TD>
              <TD className="text-right font-mono text-text-secondary">
                ${formatNumber(row.passive, { decimals: 0 })}
              </TD>
              <TD className="text-right font-mono text-xs text-text-muted">
                {row.byLevel
                  .slice(0, 4)
                  .map((l) => formatNumber(l.amount, { decimals: 0 }))
                  .join(" · ")}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
