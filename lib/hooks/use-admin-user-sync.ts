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
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { fetchCurrentUser } from "@/lib/api/client";
import type { AdminUser } from "@/lib/admin/store";
import { mapBackendUserToAdmin } from "@/lib/admin/sync-users-from-backend";
import { recomputeWithdrawalUnlock } from "@/lib/admin/user-fields";
import type { DownlineMember } from "@/lib/referrals/store";

function unlockVolumeForMember(member: DownlineMember): number {
  const volume = Math.max(
    member.realDepositVolume ?? 0,
    member.realCapital ?? 0,
  );
  if (volume <= 0) return 0;
  return volume;
}

function liveUnlockVolumesFromDownline(downline: DownlineMember[]): {
  directSalesVolume: number;
  levelVolumes: number[];
} {
  return {
    directSalesVolume: downline
      .filter((m) => m.level === 1)
      .reduce((a, m) => a + unlockVolumeForMember(m), 0),
    levelVolumes: Array.from({ length: 8 }, (_, i) => {
      const lvl = i + 1;
      return downline
        .filter((m) => m.level === lvl)
        .reduce((a, m) => a + unlockVolumeForMember(m), 0);
    }),
  };
}

function mergeUnlockMetrics(
  user: AdminUser,
  live: { directSalesVolume: number; levelVolumes: number[] },
): AdminUser {
  const next = recomputeWithdrawalUnlock({
    ...user,
    directSalesVolume: Math.max(user.directSalesVolume, live.directSalesVolume),
    levelVolumes: user.levelVolumes.map((v, i) =>
      Math.max(v, live.levelVolumes[i] ?? 0),
    ),
  });
  // Progress volumes can update live; full unlock flag stays server-owned.
  return {
    ...next,
    withdrawalUnlocked: user.withdrawalUnlocked,
    withdrawalAllowance: user.withdrawalAllowance,
    ibStrategyId: user.ibStrategyId,
  };
}

export function useAdminUserSync(): void {
  const backend = useBackendAvailable();
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
      .filter((m) => m.level === 1)
      .reduce((a, m) => a + unlockVolumeForMember(m), 0),
  );
  const levelVolumes = useReferralsStore(
    useShallow((s) =>
      Array.from({ length: 8 }, (_, i) => {
        const lvl = i + 1;
        return s.downline
          .filter((m) => m.level === lvl)
          .reduce((a, m) => a + unlockVolumeForMember(m), 0);
      }),
    ),
  );

  useDebouncedEffect(
    () => {
      if (!address || backend) return;
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
      backend,
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

function eligibilityFromAdminUser(
  adminUser: AdminUser | null,
  address: string | undefined,
): WithdrawalEligibilityResult & { adminUser: AdminUser | null } {
  if (!address) {
    return {
      eligible: false,
      directSalesMet: false,
      networkLevelsMet: false,
      messageKey: "walletPage.withdraw.connectFirst",
      adminUser: null,
    };
  }

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
}

export function useWithdrawalEligibility(): WithdrawalEligibilityResult & {
  adminUser: ReturnType<typeof useAdminStore.getState>["users"][number] | null;
} {
  const backend = useBackendAvailable();
  const visible = usePageVisible();
  const { address } = useAccount();
  const users = useAdminStore((s) => s.users);
  const downline = useReferralsStore((s) => s.downline);
  const serverSnapshotLoaded = useReferralsStore((s) => s.serverSnapshotLoaded);
  const [sessionUser, setSessionUser] = React.useState<
    ReturnType<typeof mapBackendUserToAdmin> | null
  >(null);

  React.useEffect(() => {
    if (!backend || !address || !visible) return;

    let cancelled = false;

    async function loadSessionUser() {
      try {
        const res = await fetchCurrentUser();
        if (cancelled || !res.backend || !res.user) {
          if (!cancelled) setSessionUser(null);
          return;
        }
        setSessionUser(
          mapBackendUserToAdmin({
            id: res.user.id,
            walletAddress: res.user.walletAddress,
            username: res.user.username,
            earningsBalance: res.user.earningsBalance,
            lockedCapital: res.user.lockedCapital,
            totalEarned: res.user.totalEarned,
            isActive: res.user.isActive,
            role: res.user.role,
            registrationSource: res.user.registrationSource,
            referrerWallet: res.user.referrerWallet,
            referrerUsername: res.user.referrerUsername,
            directReferrals: res.user.directReferrals,
            accountGranted: res.user.accountGranted,
            withdrawalUnlocked: res.user.withdrawalUnlocked,
            withdrawalAllowance: res.user.withdrawalAllowance ?? 0,
            ibStrategyId: res.user.ibStrategyId ?? null,
            withdrawalRule: res.user.withdrawalRule,
            realCapital: res.user.realCapital,
            companyCapital: res.user.companyCapital,
            directSalesVolume: res.user.directSalesVolume,
            levelVolumes: res.user.levelVolumes,
            createdAt: res.user.createdAt,
          }),
        );
      } catch {
        if (!cancelled) setSessionUser(null);
      }
    }

    void loadSessionUser();
    const timer = window.setInterval(() => void loadSessionUser(), 8_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [backend, address, visible, serverSnapshotLoaded]);

  return React.useMemo(() => {
    if (backend) {
      if (sessionUser) {
        let merged = sessionUser;
        if (sessionUser.accountGranted && serverSnapshotLoaded && downline.length > 0) {
          merged = mergeUnlockMetrics(
            sessionUser,
            liveUnlockVolumesFromDownline(downline),
          );
        }
        return eligibilityFromAdminUser(merged, address);
      }
      // Postgres is source of truth — do not block on stale local admin demo data.
      return {
        eligible: true,
        directSalesMet: true,
        networkLevelsMet: true,
        messageKey: "walletPage.withdraw.eligibilityOpen",
        adminUser: null,
      };
    }

    const adminUser =
      address && users.length > 0
        ? users.find((u) => u.wallet.toLowerCase() === address.toLowerCase()) ??
          null
        : null;

    return eligibilityFromAdminUser(adminUser, address);
  }, [backend, sessionUser, address, users, downline, serverSnapshotLoaded]);
}
