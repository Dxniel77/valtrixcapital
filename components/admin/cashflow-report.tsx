"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import type { AdminMovement } from "@/lib/admin/store";
import { computeCashFlow, exportCashFlowCsv } from "@/lib/admin/cashflow";
import {
  defaultReportFromDate,
  defaultReportToDate,
  parseReportDateEnd,
  parseReportDateStart,
} from "@/lib/admin/report-dates";
import { formatNumber } from "@/lib/utils";
import { fetchAdminReportsSummary } from "@/lib/api/client";
import { WithdrawalFeesPanel } from "@/components/admin/withdrawal-fees-panel";

export function CashFlowReport({ movements }: { movements: AdminMovement[] }) {
  const { t } = useI18n();
  const [from, setFrom] = React.useState(defaultReportFromDate);
  const [to, setTo] = React.useState(defaultReportToDate);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState(false);
  const [liveSummary, setLiveSummary] = React.useState<
    Awaited<ReturnType<typeof fetchAdminReportsSummary>>["summary"] | null
  >(null);

  const fromMs = parseReportDateStart(from);
  const toMs = parseReportDateEnd(to);

  const localSummary = React.useMemo(
    () => computeCashFlow(movements, fromMs, toMs),
    [movements, fromMs, toMs],
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(false);

    void fetchAdminReportsSummary(from, to)
      .then((res) => {
        if (!cancelled) {
          setLiveSummary(res.summary);
          setFetchError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveSummary(null);
          setFetchError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const summary = liveSummary ?? {
    ...localSummary,
    tradeBonusPaid: 0,
    referralCommissionPaid: localSummary.commissionPaid,
    withdrawalFeesEarned: 0,
    withdrawalFees: [],
  };

  const usingLocalFallback = liveSummary === null && !loading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>{t("admin.cashflow.title")}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCashFlowCsv(movements, fromMs, toMs)}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-secondary">{t("admin.cashflow.subtitle")}</p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-text-muted">
                {t("admin.cashflow.from")}
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-text-muted">
                {t("admin.cashflow.to")}
              </label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-text-muted">{t("admin.cashflow.loading")}</p>
          ) : null}

          {fetchError && usingLocalFallback ? (
            <p className="text-sm text-warning">{t("admin.cashflow.fallbackHint")}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <FlowStat
              label={t("admin.cashflow.inflow")}
              value={summary.inflow}
              variant="in"
            />
            <FlowStat
              label={t("admin.cashflow.outflow")}
              value={summary.outflow}
              variant="out"
            />
            <FlowStat
              label={t("admin.cashflow.net")}
              value={summary.net}
              variant="net"
            />
          </div>

          <div className="rounded-lg border border-border-subtle bg-bg-base/50 p-4 text-sm">
            <p className="text-text-secondary">
              {t("admin.cashflow.summaryLine", {
                in: formatNumber(summary.inflow, { decimals: 0 }),
                out: formatNumber(summary.outflow, { decimals: 0 }),
                net: formatNumber(summary.net, { decimals: 0 }),
              })}
            </p>
            {summary.pendingOutflow > 0 ? (
              <p className="mt-2 text-warning">
                {t("admin.cashflow.pending", {
                  amount: formatNumber(summary.pendingOutflow, { decimals: 2 }),
                })}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 text-xs text-text-muted sm:grid-cols-2 lg:grid-cols-3">
            <p>
              {t("admin.cashflow.deposits")}: {summary.depositCount} · $
              {formatNumber(summary.inflow, { decimals: 2 })}
            </p>
            <p>
              {t("admin.cashflow.withdrawals")}: {summary.withdrawalCount} · $
              {formatNumber(summary.outflow, { decimals: 2 })}
            </p>
            <p>
              {t("admin.cashflow.yieldPaid")}: $
              {formatNumber(summary.yieldPaid, { decimals: 2 })}
            </p>
            <p>
              {t("admin.cashflow.tradeBonusPaid")}: $
              {formatNumber(summary.tradeBonusPaid, { decimals: 2 })}
            </p>
            <p>
              {t("admin.cashflow.commissionPaid")}: $
              {formatNumber(summary.referralCommissionPaid, { decimals: 2 })}
            </p>
            <p>
              {t("admin.cashflow.withdrawalFeesEarned")}: $
              {formatNumber(summary.withdrawalFeesEarned, { decimals: 2 })}
            </p>
          </div>
        </CardContent>
      </Card>

      {liveSummary ? (
        <WithdrawalFeesPanel
          fees={liveSummary.withdrawalFees}
          totalFees={liveSummary.withdrawalFeesEarned}
          withdrawalCount={liveSummary.withdrawalCount}
        />
      ) : null}
    </div>
  );
}

function FlowStat({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "in" | "out" | "net";
}) {
  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <p className="text-xs uppercase tracking-wider text-text-muted">{label}</p>
      <p
        className={
          variant === "in"
            ? "mt-1 font-mono text-xl text-success"
            : variant === "out"
              ? "mt-1 font-mono text-xl text-danger"
              : "mt-1 font-mono text-xl text-gold"
        }
      >
        ${formatNumber(value, { decimals: 2 })}
      </p>
    </div>
  );
}
