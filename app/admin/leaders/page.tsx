"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/context";
import {
  billingPeriodTotal,
  type LeaderPeriod,
  type UserLeaderRow,
} from "@/lib/admin/analytics";
import { exportLeadersCsv } from "@/lib/admin/exports";
import { fetchAdminLeaders } from "@/lib/api/client";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { useTablePagination } from "@/lib/hooks/use-table-pagination";
import { TablePagination } from "@/components/admin/table-pagination";
import { cn, formatNumber, shortenAddress } from "@/lib/utils";

function mapApiRow(
  row: Awaited<ReturnType<typeof fetchAdminLeaders>>["rows"][number],
): UserLeaderRow {
  return {
    user: {
      id: row.userId,
      alias: row.alias,
      wallet: row.wallet,
      role: "USER",
      status: "ACTIVE",
      network: "BSC",
      capital: 0,
      realCapital: 0,
      companyCapital: 0,
      balance: 0,
      totalEarned: 0,
      referrals: 0,
      uplineWallet: row.isDirectAccount ? null : "",
      referrerUsername: null,
      registrationSource: row.registrationSource,
      joinedAt: 0,
      accountGranted: false,
      withdrawalUnlocked: false,
      withdrawalAllowance: 0,
      ibStrategyId: null,
      ibBoost: null,
      withdrawalRule: {
        mode: "either",
        directSalesMin: 0,
        level1VolumeMin: 0,
        level2VolumeMin: 0,
      },
      directSalesVolume: 0,
      levelVolumes: [0, 0, 0, 0, 0, 0, 0, 0],
      operationalEarned: 0,
      networkEarned: 0,
      passiveEarned: 0,
    },
    total: row.total,
    operational: row.operational,
    network: row.network,
    passive: row.passive,
    tradesCount: row.tradesCount,
    winsCount: row.winsCount,
    isDirectAccount: row.isDirectAccount,
    byLevel: row.byLevel.map((l) => ({ level: l.level, amount: l.amount })),
  };
}

export default function AdminLeadersPage() {
  const { t } = useI18n();
  const backend = useBackendAvailable();
  const [period, setPeriod] = React.useState<LeaderPeriod>("week");
  const [rows, setRows] = React.useState<UserLeaderRow[]>([]);
  const [directAccounts, setDirectAccounts] = React.useState<
    Awaited<ReturnType<typeof fetchAdminLeaders>>["directAccounts"] | null
  >(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!backend) {
      setRows([]);
      setDirectAccounts(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchAdminLeaders(period)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows.map(mapApiRow));
        setDirectAccounts(res.directAccounts);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setDirectAccounts(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [backend, period]);

  const pagination = useTablePagination(rows, { resetKey: period });
  const rowOffset = (pagination.page - 1) * pagination.pageSize;

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
            disabled={rows.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            {t("admin.leaders.export")}
          </Button>
        }
      />

      {directAccounts ? (
        <Card className="border-gold/20 bg-gold/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-text-primary">
              {t("admin.leaders.directTitle")}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {t("admin.leaders.directDesc")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label={t("admin.leaders.directAccounts")}
                value={String(directAccounts.accountCount)}
              />
              <Metric
                label={t("admin.leaders.colTotal")}
                value={`$${formatNumber(directAccounts.total, { decimals: 0 })}`}
              />
              <Metric
                label={t("admin.leaders.colOperational")}
                value={`$${formatNumber(directAccounts.operational, { decimals: 0 })}`}
              />
              <Metric
                label={t("admin.leaders.colPassive")}
                value={`$${formatNumber(directAccounts.passive, { decimals: 0 })}`}
              />
              <Metric
                label={t("admin.leaders.colNetwork")}
                value={`$${formatNumber(directAccounts.network, { decimals: 0 })}`}
              />
              <Metric
                label={t("admin.leaders.colTrades")}
                value={String(directAccounts.tradesCount)}
              />
              <Metric
                label={t("admin.leaders.colWins")}
                value={String(directAccounts.winsCount)}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

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

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("admin.leaders.loading")}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border-subtle p-10 text-center text-sm text-text-secondary">
          {t("admin.leaders.empty")}
        </div>
      ) : (
        <div className="space-y-0">
        <Table>
          <thead>
            <THeadRow>
              <TH>#</TH>
              <TH>{t("admin.leaders.colUser")}</TH>
              <TH className="text-right">{t("admin.leaders.colTrades")}</TH>
              <TH className="text-right">{t("admin.leaders.colWins")}</TH>
              <TH className="text-right">{t("admin.leaders.colTotal")}</TH>
              <TH className="text-right">{t("admin.leaders.colOperational")}</TH>
              <TH className="text-right">{t("admin.leaders.colNetwork")}</TH>
              <TH className="text-right">{t("admin.leaders.colPassive")}</TH>
              <TH className="text-right">L1–L8</TH>
            </THeadRow>
          </thead>
          <TBody>
            {pagination.paginatedItems.map((row, i) => (
              <TR key={row.user.id}>
                <TD>
                  {rowOffset + i < 3 ? (
                    <Badge variant="gold">{rowOffset + i + 1}</Badge>
                  ) : (
                    <span className="font-mono text-text-muted">{rowOffset + i + 1}</span>
                  )}
                </TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium text-text-primary">{row.user.alias}</p>
                      <p className="font-mono text-xs text-text-muted">
                        {shortenAddress(row.user.wallet)}
                      </p>
                    </div>
                    {!row.isDirectAccount ? null : (
                      <Badge variant="info" className="text-[10px]">
                        {t("admin.leaders.directBadge")}
                      </Badge>
                    )}
                  </div>
                </TD>
                <TD className="text-right font-mono text-text-secondary">
                  {row.tradesCount ?? 0}
                </TD>
                <TD className="text-right font-mono text-text-secondary">
                  {row.winsCount ?? 0}
                </TD>
                <TD className="text-right font-mono text-gold">
                  ${formatNumber(billingPeriodTotal(row), { decimals: 2 })}
                </TD>
                <TD className="text-right font-mono text-text-secondary">
                  ${formatNumber(row.operational, { decimals: 2 })}
                </TD>
                <TD className="text-right font-mono text-text-secondary">
                  ${formatNumber(row.network, { decimals: 2 })}
                </TD>
                <TD className="text-right font-mono text-text-secondary">
                  ${formatNumber(row.passive, { decimals: 2 })}
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
        <TablePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          rangeStart={pagination.rangeStart}
          rangeEnd={pagination.rangeEnd}
          pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm text-text-primary">{value}</p>
    </div>
  );
}
