"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { useShallow } from "zustand/react/shallow";
import { useAdminStore } from "@/lib/admin/store";
import { useStakingStore } from "@/lib/staking/store";
import { useReferralsStore } from "@/lib/referrals/store";
import { selectActiveCapital } from "@/lib/staking/selectors";
import {
  evaluateWithdrawalEligibility,
  type WithdrawalEligibilityResult,
} from "@/lib/admin/withdrawal-eligibility";
import { useDebouncedEffect } from "@/lib/hooks/use-debounced-effect";

export function useAdminUserSync(): void {
  const { address } = useAccount();
  const sync = useAdminStore((s) => s.syncLiveUserMetrics);
  const capital = useStakingStore((s) => selectActiveCapital(s.stakes));
  const balance = useStakingStore((s) => s.earningsBalance);
  const totalEarned = useStakingStore((s) => s.totalEarned);
  const operationalEarned = useStakingStore((s) =>
    s.instantCredits.reduce((a, c) => a + c.amount, 0),
  );
  const passiveEarned = useStakingStore((s) =>
    s.dailyYields.reduce((a, y) => a + y.creditedAmount, 0),
  );
  const totalCommissions = useReferralsStore((s) => s.totalCommissions);
  const directReferrals = useReferralsStore(
    (s) => s.downline.filter((m) => m.level === 1).length,
  );
  const directSalesVolume = useReferralsStore((s) =>
    s.downline
      .filter((m) => m.level === 1 && m.isActive)
      .reduce((a, m) => a + m.capital, 0),
  );
  const levelVolumes = useReferralsStore(
    useShallow((s) =>
      Array.from({ length: 8 }, (_, i) => {
        const lvl = i + 1;
        return s.commissions
          .filter((c) => c.level === lvl)
          .reduce((a, c) => a + c.amount, 0);
      }),
    ),
  );

  useDebouncedEffect(
    () => {
      if (!address) return;
      sync(address, {
        capital,
        balance,
        totalEarned,
        operationalEarned,
        networkEarned: totalCommissions,
        passiveEarned,
        directReferrals,
        directSalesVolume,
        levelVolumes,
      });
    },
    [
      address,
      sync,
      capital,
      balance,
      totalEarned,
      operationalEarned,
      passiveEarned,
      totalCommissions,
      directReferrals,
      directSalesVolume,
      levelVolumes,
    ],
    350,
  );
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
