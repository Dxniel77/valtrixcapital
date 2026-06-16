"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { useAdminStore } from "@/lib/admin/store";
import { useStakingStore } from "@/lib/staking/store";
import { useReferralsStore } from "@/lib/referrals/store";
import { useWalletStore } from "@/lib/wallet/store";
import { useDebouncedEffect } from "@/lib/hooks/use-debounced-effect";
import { useDeferredMount } from "@/lib/hooks/use-deferred-mount";

/** Mirrors live user ledger events into the admin movements feed. */
export function AdminMovementBridge() {
  const ready = useDeferredMount(1500);
  const { address } = useAccount();
  const syncLiveMovements = useAdminStore((s) => s.syncLiveMovements);
  const stakes = useStakingStore((s) => s.stakes);
  const pendingDeposit = useStakingStore((s) => s.pendingDeposit);
  const dailyYields = useStakingStore((s) => s.dailyYields);
  const instantCredits = useStakingStore((s) => s.instantCredits);
  const commissions = useReferralsStore((s) => s.commissions);
  const withdrawals = useWalletStore((s) => s.withdrawals);

  useDebouncedEffect(
    () => {
      if (!ready || !address) return;
      const wallet = address;
      const movements = [];

      for (const st of stakes) {
        movements.push({
          id: `live_dep_${st.id}`,
          type: "DEPOSIT" as const,
          wallet,
          amount: st.amount,
          network: st.network,
          status: st.status === "ACTIVE" ? "COMPLETED" : st.status,
          timestamp: st.confirmedAt ?? st.createdAt,
        });
      }

      if (pendingDeposit) {
        movements.push({
          id: `live_dep_pending_${pendingDeposit.id}`,
          type: "DEPOSIT" as const,
          wallet,
          amount: pendingDeposit.amount,
          network: pendingDeposit.network,
          status: "PENDING" as const,
          timestamp: pendingDeposit.startedAt,
        });
      }

      for (const w of withdrawals) {
        movements.push({
          id: `live_wd_${w.id}`,
          type: "WITHDRAWAL" as const,
          wallet,
          amount: w.amount,
          network: w.network,
          status: w.status,
          timestamp: w.updatedAt ?? w.createdAt,
        });
      }

      for (const y of dailyYields) {
        movements.push({
          id: `live_yld_${y.id}`,
          type: "YIELD" as const,
          wallet,
          amount: y.creditedAmount,
          yieldKind: "passive" as const,
          network: null,
          status: "COMPLETED" as const,
          timestamp: y.createdAt,
        });
      }

      for (const c of instantCredits) {
        movements.push({
          id: `live_op_${c.id}`,
          type: "YIELD" as const,
          wallet,
          amount: c.amount,
          yieldKind: "operational" as const,
          network: null,
          status: "COMPLETED" as const,
          timestamp: c.createdAt,
        });
      }

      for (const c of commissions) {
        movements.push({
          id: `live_com_${c.id}`,
          type: "COMMISSION" as const,
          wallet,
          amount: c.amount,
          network: null,
          status: "COMPLETED" as const,
          timestamp: c.createdAt,
        });
      }

      syncLiveMovements(movements);
    },
    [
      ready,
      address,
      syncLiveMovements,
      stakes,
      pendingDeposit,
      dailyYields,
      instantCredits,
      commissions,
      withdrawals,
    ],
    500,
  );

  return null;
}
