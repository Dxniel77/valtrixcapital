"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { useAdminStore } from "@/lib/admin/store";
import { useStakingStore } from "@/lib/staking/store";
import { useReferralsStore } from "@/lib/referrals/store";
import { useWalletStore } from "@/lib/wallet/store";

/** Mirrors live user ledger events into the admin movements feed. */
export function AdminMovementBridge() {
  const { address } = useAccount();
  const recordMovement = useAdminStore((s) => s.recordMovement);
  const stakes = useStakingStore((s) => s.stakes);
  const pendingDeposit = useStakingStore((s) => s.pendingDeposit);
  const dailyYields = useStakingStore((s) => s.dailyYields);
  const instantCredits = useStakingStore((s) => s.instantCredits);
  const commissions = useReferralsStore((s) => s.commissions);
  const withdrawals = useWalletStore((s) => s.withdrawals);

  React.useEffect(() => {
    if (!address) return;
    const wallet = address;

    for (const st of stakes) {
      recordMovement({
        id: `live_dep_${st.id}`,
        type: "DEPOSIT",
        wallet,
        amount: st.amount,
        network: st.network,
        status: st.status === "ACTIVE" ? "COMPLETED" : st.status,
        timestamp: st.confirmedAt ?? st.createdAt,
      });
    }

    if (pendingDeposit) {
      recordMovement({
        id: `live_dep_pending_${pendingDeposit.id}`,
        type: "DEPOSIT",
        wallet,
        amount: pendingDeposit.amount,
        network: pendingDeposit.network,
        status: "PENDING",
        timestamp: pendingDeposit.startedAt,
      });
    }

    for (const w of withdrawals) {
      recordMovement({
        id: `live_wd_${w.id}`,
        type: "WITHDRAWAL",
        wallet,
        amount: w.amount,
        network: w.network,
        status: w.status,
        timestamp: w.updatedAt ?? w.createdAt,
      });
    }

    for (const y of dailyYields) {
      recordMovement({
        id: `live_yld_${y.id}`,
        type: "YIELD",
        wallet,
        amount: y.creditedAmount,
        yieldKind: "passive",
        network: null,
        status: "COMPLETED",
        timestamp: y.createdAt,
      });
    }

    for (const c of instantCredits) {
      recordMovement({
        id: `live_op_${c.id}`,
        type: "YIELD",
        wallet,
        amount: c.amount,
        yieldKind: "operational",
        network: null,
        status: "COMPLETED",
        timestamp: c.createdAt,
      });
    }

    for (const c of commissions) {
      recordMovement({
        id: `live_com_${c.id}`,
        type: "COMMISSION",
        wallet,
        amount: c.amount,
        network: null,
        status: "COMPLETED",
        timestamp: c.createdAt,
      });
    }
  }, [
    address,
    recordMovement,
    stakes,
    pendingDeposit,
    dailyYields,
    instantCredits,
    commissions,
    withdrawals,
  ]);

  return null;
}
