"use client";

import * as React from "react";
import Link from "next/link";
import { Coins, Landmark, ShieldAlert, TrendingUp, Users } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { DailyTransactionsPanel } from "@/components/admin/daily-transactions-panel";
import { PendingWithdrawalsPanel } from "@/components/admin/pending-withdrawals-panel";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStats, useAdminStore } from "@/lib/admin/store";
import {
  useTreasuryStoreHydrated,
  useTreasurySummary,
} from "@/lib/admin/treasury-store";
import { formatNumber } from "@/lib/utils";
import { utcDateKey } from "@/lib/admin/movements";

export default function AdminOverviewPage() {
  const { t } = useI18n();
  const stats = useAdminStats();
  const treasury = useTreasurySummary();
  const treasuryHydrated = useTreasuryStoreHydrated();
  const audit = useAdminStore((s) => s.audit);
  const movements = useAdminStore((s) => s.movements);

  const lowLiquidity =
    treasuryHydrated && treasury.totalBalance < stats.liabilities;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.overview.title")}
        subtitle={t("admin.overview.subtitle")}
        actions={
          <Button asChild variant="primary" size="md">
            <Link href="/admin/treasury">
              <Landmark className="h-4 w-4" />
              {t("admin.treasury.manageCta")}
            </Link>
          </Button>
        }
      />

      {lowLiquidity ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          {t("admin.treasury.overviewWarning", {
            balance: formatNumber(treasury.totalBalance, { decimals: 0 }),
            liabilities: formatNumber(stats.liabilities, { decimals: 0 }),
          })}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label={t("admin.overview.totalUsers")}
          value={String(stats.totalUsers)}
          icon={Users}
          accent="gold"
          hint={t("admin.overview.activeOf", { n: stats.activeUsers })}
        />
        <StatTile
          label={t("admin.overview.tvl")}
          value={`$${formatNumber(stats.tvl, { decimals: 0 })}`}
          icon={TrendingUp}
          accent="success"
          hint={t("admin.overview.tvlHint")}
        />
        <StatTile
          label={t("admin.overview.liabilities")}
          value={`$${formatNumber(stats.liabilities, { decimals: 0 })}`}
          icon={Coins}
          accent="info"
          hint={t("admin.overview.liabilitiesHint")}
        />
        <StatTile
          label={t("admin.overview.pendingWithdrawals")}
          value={String(stats.withdrawalsPending)}
          icon={ShieldAlert}
          accent="danger"
          hint={t("admin.overview.pendingHint")}
        />
        <StatTile
          label={t("admin.treasury.totalLiquidity")}
          value={`$${formatNumber(treasuryHydrated ? treasury.totalBalance : 0, { decimals: 0 })}`}
          icon={Landmark}
          accent={lowLiquidity ? "danger" : "gold"}
          hint={t("admin.treasury.totalLiquidityHint")}
        />
      </div>

      <DailyTransactionsPanel
        movements={movements}
        dayKey={utcDateKey()}
        limit={8}
        showDateControls={false}
        title={t("admin.overview.dailyTransactionsTitle")}
        viewAllHref={`/admin/movements?date=${utcDateKey()}`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{t("admin.overview.pendingTitle")}</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/treasury">{t("admin.treasury.manageCta")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <PendingWithdrawalsPanel limit={4} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{t("admin.overview.recentAudit")}</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/audit">{t("admin.overview.viewAll")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <p className="rounded-md border border-dashed border-border-subtle bg-bg-base/40 p-6 text-center text-sm text-text-secondary">
                {t("admin.overview.noAudit")}
              </p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {audit.slice(0, 6).map((a) => (
                  <li key={a.id} className="py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-text-primary">
                        {t(`admin.actions.${a.action}`)}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(a.timestamp).toLocaleString("es-ES", {
                          timeZone: "UTC",
                          hour12: false,
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">
                      {a.target} · {a.detail}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
