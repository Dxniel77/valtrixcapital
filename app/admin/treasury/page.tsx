"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Landmark, ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TreasuryDepositModal } from "@/components/admin/treasury-deposit-modal";
import { TreasuryWithdrawModal } from "@/components/admin/treasury-withdraw-modal";
import { PendingWithdrawalsPanel } from "@/components/admin/pending-withdrawals-panel";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStats } from "@/lib/admin/store";
import {
  useTreasuryStore,
  useTreasuryStoreHydrated,
  useTreasurySummary,
} from "@/lib/admin/treasury-store";
import { formatNumber } from "@/lib/utils";

export default function AdminTreasuryPage() {
  const { t } = useI18n();
  const stats = useAdminStats();
  const treasury = useTreasurySummary();
  const hydrated = useTreasuryStoreHydrated();
  const allDeposits = useTreasuryStore((s) => s.deposits);
  const allWithdrawals = useTreasuryStore((s) => s.withdrawals);
  const deposits = React.useMemo(() => allDeposits.slice(0, 8), [allDeposits]);
  const withdrawals = React.useMemo(
    () => allWithdrawals.slice(0, 8),
    [allWithdrawals],
  );

  const [depositOpen, setDepositOpen] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);

  const coveragePct =
    stats.liabilities > 0
      ? Math.min(100, (treasury.totalBalance / stats.liabilities) * 100)
      : 100;
  const lowLiquidity = hydrated && treasury.totalBalance < stats.liabilities;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.treasury.title")}
        subtitle={t("admin.treasury.subtitle")}
        actions={
          <>
            <Button variant="outline" size="md" asChild>
              <Link href="/admin/hot-wallet">
                <Landmark className="h-4 w-4" />
                {t("admin.treasury.outflowsCta")}
              </Link>
            </Button>
            <Button variant="outline" size="md" onClick={() => setWithdrawOpen(true)}>
              <ArrowUpFromLine className="h-4 w-4" />
              {t("admin.treasury.withdrawCta")}
            </Button>
            <Button variant="primary" size="md" onClick={() => setDepositOpen(true)}>
              <ArrowDownToLine className="h-4 w-4" />
              {t("admin.treasury.depositCta")}
            </Button>
          </>
        }
      />

      {lowLiquidity ? (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div>
            <p className="font-medium text-danger">{t("admin.treasury.lowLiquidityTitle")}</p>
            <p className="mt-1 text-text-secondary">
              {t("admin.treasury.lowLiquidityDesc", {
                balance: formatNumber(treasury.totalBalance, { decimals: 0 }),
                liabilities: formatNumber(stats.liabilities, { decimals: 0 }),
              })}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label={t("admin.treasury.totalLiquidity")}
          value={`$${formatNumber(hydrated ? treasury.totalBalance : 0, { decimals: 2 })}`}
          icon={Landmark}
          accent="gold"
          hint={t("admin.treasury.totalLiquidityHint")}
        />
        <StatTile
          label={t("admin.treasury.totalLoaded")}
          value={`$${formatNumber(hydrated ? treasury.adminDeposited : 0, { decimals: 2 })}`}
          icon={ArrowDownToLine}
          accent="success"
          hint={t("admin.treasury.totalLoadedHint")}
        />
        <StatTile
          label={t("admin.treasury.totalPaidOut")}
          value={`$${formatNumber(hydrated ? treasury.paidOut : 0, { decimals: 2 })}`}
          icon={ArrowUpFromLine}
          accent="danger"
          hint={t("admin.treasury.totalPaidOutHint")}
        />
        <StatTile
          label={t("admin.treasury.bscBalance")}
          value={`$${formatNumber(hydrated ? treasury.bscBalance : 0, { decimals: 2 })}`}
          icon={ArrowDownToLine}
          accent="info"
          hint="BEP-20"
        />
        <StatTile
          label={t("admin.treasury.polygonBalance")}
          value={`$${formatNumber(hydrated ? treasury.polygonBalance : 0, { decimals: 2 })}`}
          icon={ArrowDownToLine}
          accent="success"
          hint="Polygon"
        />
        <StatTile
          label={t("admin.treasury.coverage")}
          value={`${formatNumber(coveragePct, { decimals: 0 })}%`}
          icon={ShieldAlert}
          accent={lowLiquidity ? "danger" : "success"}
          hint={t("admin.treasury.coverageHint")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.withdrawals.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PendingWithdrawalsPanel />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.treasury.recentDeposits")}</CardTitle>
          </CardHeader>
          <CardContent>
            {deposits.length === 0 ? (
              <p className="text-sm text-text-muted">{t("admin.treasury.noDeposits")}</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {deposits.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <div>
                      <Badge variant="success">+USDT</Badge>
                      <span className="ml-2 text-text-muted">{d.network}</span>
                    </div>
                    <span className="font-mono text-success">
                      +${formatNumber(d.amount, { decimals: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.treasury.recentWithdrawals")}</CardTitle>
          </CardHeader>
          <CardContent>
            {withdrawals.length === 0 ? (
              <p className="text-sm text-text-muted">{t("admin.treasury.noWithdrawals")}</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {withdrawals.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <div>
                      <Badge variant="danger">−USDT</Badge>
                      <span className="ml-2 text-text-muted">{w.network}</span>
                    </div>
                    <span className="font-mono text-danger">
                      −${formatNumber(w.amount, { decimals: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <TreasuryDepositModal open={depositOpen} onOpenChange={setDepositOpen} />
      <TreasuryWithdrawModal open={withdrawOpen} onOpenChange={setWithdrawOpen} />
    </div>
  );
}
