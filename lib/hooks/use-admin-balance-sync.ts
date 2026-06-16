"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { useAdminStore, useAdminStoreHydrated } from "@/lib/admin/store";
import {
  useStakingStore,
  useStakingStoreHydrated,
} from "@/lib/staking/store";
import { useI18n } from "@/lib/i18n/context";
import { pushNotification } from "@/lib/notifications/push";
import { formatNumber } from "@/lib/utils";

/** Applies pending admin balance adjustments to the connected user's staking store. */
export function useAdminBalanceSync(): void {
  const { address } = useAccount();
  const adminHydrated = useAdminStoreHydrated();
  const stakingHydrated = useStakingStoreHydrated();
  const balanceAdjustments = useAdminStore((s) => s.balanceAdjustments);
  const markApplied = useAdminStore((s) => s.markBalanceAdjustmentsApplied);
  const applyBalanceAdjustment = useStakingStore((s) => s.applyBalanceAdjustment);
  const { t } = useI18n();

  React.useEffect(() => {
    if (!adminHydrated || !stakingHydrated || !address) return;

    const wallet = address.toLowerCase();
    const pending = balanceAdjustments
      .filter((a) => a.wallet.toLowerCase() === wallet && a.appliedAt === null)
      .sort((a, b) => a.createdAt - b.createdAt);

    if (pending.length === 0) return;

    const appliedIds: string[] = [];

    for (const adj of pending) {
      const stakingState = useStakingStore.getState();
      if (stakingState.balanceAdjustments.some((b) => b.id === adj.id)) {
        appliedIds.push(adj.id);
        continue;
      }

      applyBalanceAdjustment({
        id: adj.id,
        amount: adj.delta,
        note: adj.note,
      });

      const entry = useStakingStore
        .getState()
        .balanceAdjustments.find((b) => b.id === adj.id);
      if (!entry) continue;

      appliedIds.push(adj.id);
      const isCredit = entry.amount >= 0;
      const amountLabel = formatNumber(Math.abs(entry.amount), { decimals: 2 });
      const noteSuffix = entry.note.trim()
        ? t("notifications.events.adjustmentNoteSuffix", { note: entry.note.trim() })
        : "";

      pushNotification({
        kind: "system",
        title: t(
          isCredit
            ? "notifications.events.adjustmentCreditTitle"
            : "notifications.events.adjustmentDebitTitle",
        ),
        body:
          t(
            isCredit
              ? "notifications.events.adjustmentCreditBody"
              : "notifications.events.adjustmentDebitBody",
            { amount: amountLabel },
          ) + noteSuffix,
        href: "/dashboard/history",
        dedupeKey: `adj_${adj.id}`,
      });
    }

    if (appliedIds.length > 0) {
      markApplied(appliedIds);
    }
  }, [
    adminHydrated,
    stakingHydrated,
    address,
    balanceAdjustments,
    markApplied,
    applyBalanceAdjustment,
    t,
  ]);
}
