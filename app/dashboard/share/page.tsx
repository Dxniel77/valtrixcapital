"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { useStakingStore } from "@/lib/staking/store";
import { useReferralsStore } from "@/lib/referrals/store";
import { useWalletStore } from "@/lib/wallet/store";
import { useLedger } from "@/lib/ledger";
import { useUserRegistry } from "@/lib/user/store";
import { EarningsPoster } from "@/components/share/earnings-poster";
import { computePeriodEarnings } from "@/lib/share/earnings-periods";
import { useTodayYieldPreview } from "@/lib/staking/portfolio-summary";
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
  const dailyYields = useStakingStore((s) => s.dailyYields);
  const instantCredits = useStakingStore((s) => s.instantCredits);
  const commissions = useReferralsStore((s) => s.commissions);
  const withdrawals = useWalletStore((s) => s.withdrawals);
  const ledger = useLedger();
  const preview = useTodayYieldPreview();

  const earnings = React.useMemo(
    () =>
      computePeriodEarnings({
        dailyYields,
        instantCredits,
        commissions,
        todayProjectedYield: preview.projectedAmount,
      }),
    [dailyYields, instantCredits, commissions, preview.projectedAmount],
  );

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

      <Card className="max-w-2xl">
        <CardContent className="p-6">
          <EarningsPoster username={username} earnings={earnings} />
        </CardContent>
      </Card>

      <div className="max-w-2xl space-y-3">
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
