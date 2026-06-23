"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/dashboard/page-header";
import { useI18n } from "@/lib/i18n/context";
import { useStakingStore } from "@/lib/staking/store";
import { useReferralsStore } from "@/lib/referrals/store";
import { useWalletStore } from "@/lib/wallet/store";
import { useLedger } from "@/lib/ledger";
import { useUserRegistry } from "@/lib/user/store";
import { EarningsPoster } from "@/components/share/earnings-poster";
import { ExportReportsPanel } from "@/components/share/export-reports-panel";
import { computePeriodEarnings } from "@/lib/share/earnings-periods";
import { useTodayYieldPreview } from "@/lib/staking/portfolio-summary";
import { useHasRealDepositedCapital } from "@/lib/hooks/use-capital-profile";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const hasRealCapital = useHasRealDepositedCapital();

  const earnings = React.useMemo(
    () =>
      computePeriodEarnings({
        dailyYields: hasRealCapital ? dailyYields : [],
        instantCredits: hasRealCapital ? instantCredits : [],
        commissions: hasRealCapital ? commissions : [],
        todayProjectedYield: hasRealCapital ? preview.projectedBaseAmount : 0,
      }),
    [
      dailyYields,
      instantCredits,
      commissions,
      preview.projectedBaseAmount,
      hasRealCapital,
    ],
  );

  const username = profile?.username ?? "user";

  const exportActions = React.useMemo(
    () => ({
      earnings: () => exportEarningsCsv(ledger),
      withdrawals: () => exportWithdrawalsCsv(withdrawals),
      network: () => exportNetworkCsv(ledger),
      operational: () => exportOperationalCsv(ledger),
    }),
    [ledger, withdrawals],
  );

  const exports = [
    { id: "earnings", title: t("share.exports.earnings"), action: exportActions.earnings },
    { id: "withdrawals", title: t("share.exports.withdrawals"), action: exportActions.withdrawals },
    { id: "network", title: t("share.exports.network"), action: exportActions.network },
    { id: "operational", title: t("share.exports.operational"), action: exportActions.operational },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={t("share.title")} subtitle={t("share.subtitle")} />

      <section>
        {hasRealCapital ? (
          <EarningsPoster username={username} earnings={earnings} />
        ) : (
          <SponsoredPosterGate />
        )}
      </section>

      <ExportReportsPanel items={exports} />
    </div>
  );
}

function SponsoredPosterGate() {
  const { t } = useI18n();
  return (
    <Card className="border-border-subtle">
      <CardContent className="space-y-4 py-10 text-center">
        <Badge variant="info">{t("dashboard.overview.sponsoredBadge")}</Badge>
        <h3 className="font-display text-lg font-semibold text-text-primary">
          {t("share.posterDepositRequiredTitle")}
        </h3>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary">
          {t("share.posterDepositRequiredDesc")}
        </p>
        <Button asChild variant="primary" size="md" className="mx-auto">
          <Link href="/dashboard/wallet#add-funds">
            {t("walletPage.deposit.viewAddresses")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
