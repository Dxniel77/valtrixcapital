"use client";

import * as React from "react";
import { useI18n } from "@/lib/i18n/context";
import { useStakingStore } from "@/lib/staking/store";
import { useWalletStore } from "@/lib/wallet/store";
import { useReferralsStore } from "@/lib/referrals/store";
import { pushNotification } from "@/lib/notifications/push";
import { formatNumber } from "@/lib/utils";

/** Watches financial stores and emits in-app (+ email queue) notifications. */
export function NotificationBridge() {
  const { t } = useI18n();
  const stakesLen = useStakingStore((s) => s.stakes.length);
  const yieldsLen = useStakingStore((s) => s.dailyYields.length);
  const lastYield = useStakingStore((s) => s.dailyYields[0]);
  const withdrawals = useWalletStore((s) => s.withdrawals);
  const totalCommissions = useReferralsStore((s) => s.totalCommissions);

  const prevStakes = React.useRef(stakesLen);
  const prevYields = React.useRef(yieldsLen);
  const prevWithdrawals = React.useRef<Record<string, string>>({});
  const prevCommissionMilestone = React.useRef(0);

  React.useEffect(() => {
    if (stakesLen > prevStakes.current) {
      const stake = useStakingStore.getState().stakes[0];
      if (stake) {
        pushNotification({
          kind: "system",
          title: t("notifications.events.depositTitle"),
          body: t("notifications.events.depositBody", {
            amount: formatNumber(stake.amount, { decimals: 2 }),
          }),
          href: "/dashboard/portfolio",
          dedupeKey: `dep_${stake.id}`,
        });
      }
    }
    prevStakes.current = stakesLen;
  }, [stakesLen, t]);

  React.useEffect(() => {
    if (yieldsLen > prevYields.current && lastYield) {
      pushNotification({
        kind: "system",
        title: t("notifications.events.yieldTitle"),
        body: t("notifications.events.yieldBody", {
          amount: formatNumber(lastYield.creditedAmount, { decimals: 2 }),
        }),
        href: "/dashboard/history",
        dedupeKey: `yld_${lastYield.id}`,
      });
    }
    prevYields.current = yieldsLen;
  }, [yieldsLen, lastYield, t]);

  React.useEffect(() => {
    for (const w of withdrawals) {
      const prev = prevWithdrawals.current[w.id];
      if (!prev) {
        pushNotification({
          kind: "alert",
          title: t("notifications.events.withdrawRequestedTitle"),
          body: t("notifications.events.withdrawRequestedBody", {
            amount: formatNumber(w.amount, { decimals: 2 }),
          }),
          href: "/dashboard/wallet",
          dedupeKey: `wd_req_${w.id}`,
        });
      } else if (prev !== w.status && w.status === "COMPLETED") {
        pushNotification({
          kind: "system",
          title: t("notifications.events.withdrawDoneTitle"),
          body: t("notifications.events.withdrawDoneBody", {
            net: formatNumber(w.netAmount, { decimals: 2 }),
          }),
          href: "/dashboard/history",
          dedupeKey: `wd_done_${w.id}`,
        });
      }
      prevWithdrawals.current[w.id] = w.status;
    }
  }, [withdrawals, t]);

  React.useEffect(() => {
    const milestone = Math.floor(totalCommissions / 100) * 100;
    if (milestone > 0 && milestone > prevCommissionMilestone.current) {
      prevCommissionMilestone.current = milestone;
      pushNotification({
        kind: "promo",
        title: t("notifications.events.referralTitle"),
        body: t("notifications.events.referralBody", {
          total: formatNumber(milestone, { decimals: 0 }),
        }),
        href: "/dashboard/referrals",
        dedupeKey: `ref_${milestone}`,
      });
    }
  }, [totalCommissions, t]);

  return null;
}
