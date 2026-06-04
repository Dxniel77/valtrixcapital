"use client";

import * as React from "react";
import Link from "next/link";
import { Coins, ShieldAlert, TrendingUp, Users } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStats, useAdminStore } from "@/lib/admin/store";
import { formatNumber, shortenAddress } from "@/lib/utils";

export default function AdminOverviewPage() {
  const { t } = useI18n();
  const stats = useAdminStats();
  const audit = useAdminStore((s) => s.audit);
  const movements = useAdminStore((s) => s.movements);

  const pendingWithdrawals = movements
    .filter((m) => m.type === "WITHDRAWAL" && m.status !== "COMPLETED")
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.overview.title")}
        subtitle={t("admin.overview.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{t("admin.overview.pendingTitle")}</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/movements">{t("admin.overview.viewAll")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingWithdrawals.length === 0 ? (
              <p className="rounded-md border border-dashed border-border-subtle bg-bg-base/40 p-6 text-center text-sm text-text-secondary">
                {t("admin.overview.noPending")}
              </p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {pendingWithdrawals.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="font-mono text-text-secondary">
                      {shortenAddress(m.wallet)}
                    </span>
                    <Badge variant="warning">{t(`walletPage.status.${m.status}`)}</Badge>
                    <span className="font-mono text-danger">
                      ${formatNumber(m.amount, { decimals: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
