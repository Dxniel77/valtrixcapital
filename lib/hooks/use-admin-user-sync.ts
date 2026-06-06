"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { useAdminStore } from "@/lib/admin/store";
import { useStakingStore } from "@/lib/staking/store";
import { useReferralsStore } from "@/lib/referrals/store";
import {
  evaluateWithdrawalEligibility,
  type WithdrawalEligibilityResult,
} from "@/lib/admin/withdrawal-eligibility";

export function useAdminUserSync(): void {
  const { address } = useAccount();
  const sync = useAdminStore((s) => s.syncLiveUserMetrics);
  const capital = useStakingStore((s) =>
    s.stakes.filter((st) => st.status === "ACTIVE").reduce((a, st) => a + st.amount, 0),
  );
  const balance = useStakingStore((s) => s.earningsBalance);
  const totalEarned = useStakingStore((s) => s.totalEarned);
  const instantCredits = useStakingStore((s) => s.instantCredits);
  const dailyYields = useStakingStore((s) => s.dailyYields);
  const totalCommissions = useReferralsStore((s) => s.totalCommissions);
  const downline = useReferralsStore((s) => s.downline);
  const levelStats = useReferralsStore((s) => s.commissions);

  React.useEffect(() => {
    if (!address) return;

    const operationalEarned = instantCredits.reduce((a, c) => a + c.amount, 0);
    const passiveEarned = dailyYields.reduce((a, y) => a + y.creditedAmount, 0);
    const networkEarned = totalCommissions;
    const directReferrals = downline.filter((m) => m.level === 1).length;
    const levelVolumes = Array.from({ length: 8 }, (_, i) => {
      const lvl = i + 1;
      return levelStats
        .filter((c) => c.level === lvl)
        .reduce((a, c) => a + c.amount, 0);
    });
    const directSalesVolume = downline
      .filter((m) => m.level === 1 && m.isActive)
      .reduce((a, m) => a + m.capital, 0);

    sync(address, {
      capital,
      balance,
      totalEarned,
      operationalEarned,
      networkEarned,
      passiveEarned,
      directReferrals,
      directSalesVolume,
      levelVolumes,
    });
  }, [
    address,
    sync,
    capital,
    balance,
    totalEarned,
    instantCredits,
    dailyYields,
    totalCommissions,
    downline,
    levelStats,
  ]);
}

export function useWithdrawalEligibility(): WithdrawalEligibilityResult & {
  adminUser: ReturnType<typeof useAdminStore.getState>["users"][number] | null;
} {
  const { address } = useAccount();
  const users = useAdminStore((s) => s.users);

  return React.useMemo(() => {
    if (!address) {
      return {
        eligible: false,
        directSalesMet: false,
        networkLevelsMet: false,
        messageKey: "walletPage.withdraw.connectFirst",
        adminUser: null,
      };
    }

    const adminUser =
      users.find((u) => u.wallet.toLowerCase() === address.toLowerCase()) ??
      null;

    if (!adminUser) {
      return {
        eligible: true,
        directSalesMet: true,
        networkLevelsMet: true,
        messageKey: "walletPage.withdraw.eligibilityOpen",
        adminUser: null,
      };
    }

    return {
      ...evaluateWithdrawalEligibility(adminUser),
      adminUser,
    };
  }, [address, users]);
}
