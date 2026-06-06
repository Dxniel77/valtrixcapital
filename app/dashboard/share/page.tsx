"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore } from "@/lib/admin/store";
import { computeShareEarnings } from "@/lib/admin/analytics";
import { useUserRegistry } from "@/lib/user/store";
import { usePortfolioSummary, useStakingStore } from "@/lib/staking/store";
import { useReferralsStore } from "@/lib/referrals/store";
import { useWalletStore } from "@/lib/wallet/store";
import { useLedger } from "@/lib/ledger";
import { EarningsPoster } from "@/components/share/earnings-poster";
import {
  exportEarningsCsv,
  exportNetworkCsv,
  exportOperationalCsv,
  exportWithdrawalsCsv,
} from "@/lib/user/exports";

export default function SharePage() {
  const { t } = useI18n();
  const { address } = useAccount();
  const profile = useUserRegistry((s) => s.getProfile(address));
  const users = useAdminStore((s) => s.users);
  const summary = usePortfolioSummary();
  const totalCommissions = useReferralsStore((s) => s.totalCommissions);
  const downline = useReferralsStore((s) => s.downline);
  const instantCredits = useStakingStore((s) => s.instantCredits);
  const dailyYields = useStakingStore((s) => s.dailyYields);
  const withdrawals = useWalletStore((s) => s.withdrawals);
  const ledger = useLedger();

  const earnings = React.useMemo(() => {
    const adminUser = address
      ? users.find((u) => u.wallet.toLowerCase() === address.toLowerCase())
      : null;

    if (adminUser) return computeShareEarnings(adminUser);

    const operationalEarned = instantCredits.reduce((a, c) => a + c.amount, 0);
    const passiveEarned = dailyYields.reduce((a, y) => a + y.creditedAmount, 0);
    const networkEarned = totalCommissions;

    return computeShareEarnings({
      referrals: downline.length,
      networkEarned,
      passiveEarned,
      operationalEarned,
      totalEarned: summary.totalEarned,
    } as Parameters<typeof computeShareEarnings>[0]);
  }, [
    address,
    users,
    summary.totalEarned,
    totalCommissions,
    downline.length,
    instantCredits,
    dailyYields,
  ]);

  const username = profile?.username ?? "user";

  const exports = [
    {
      title: t("share.exports.earnings"),
      action: () => exportEarningsCsv(ledger),
    },
    {
      title: t("share.exports.withdrawals"),
      action: () => exportWithdrawalsCsv(withdrawals),
    },
    {
      title: t("share.exports.network"),
      action: () => exportNetworkCsv(ledger),
    },
    {
      title: t("share.exports.operational"),
      action: () => exportOperationalCsv(ledger),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("share.title")} subtitle={t("share.subtitle")} />

      <Card className="max-w-xl">
        <CardContent className="p-6">
          <EarningsPoster username={username} earnings={earnings} />
        </CardContent>
      </Card>

      <div className="max-w-xl space-y-3">
        <h2 className="font-display text-lg font-semibold text-text-primary">
          {t("share.reportsTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {exports.map((item) => (
            <Card key={item.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" onClick={item.action}>
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
