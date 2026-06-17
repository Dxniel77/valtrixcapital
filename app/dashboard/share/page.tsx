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
        todayProjectedYield: preview.projectedBaseAmount,
      }),
    [dailyYields, instantCredits, commissions, preview.projectedBaseAmount],
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
        <EarningsPoster username={username} earnings={earnings} />
      </section>

      <ExportReportsPanel items={exports} />
    </div>
  );
}
