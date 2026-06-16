"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { useI18n } from "@/lib/i18n/context";
import {
  fetchBackendHealth,
  fetchBalanceAdjustments,
  fetchCurrentUser,
  fetchUserPortfolio,
} from "@/lib/api/client";
import { syncTradesFromServer } from "@/lib/trade/backend-trades";
import { hydratePortfolioFromServer } from "@/lib/staking/hydrate-portfolio";
import { useStakingStore } from "@/lib/staking/store";
import { useReferralsStore } from "@/lib/referrals/store";
import { pushNotification } from "@/lib/notifications/push";
import { formatNumber, shortenAddress } from "@/lib/utils";

let backendAvailable: boolean | null = null;

export function useBackendAvailable(): boolean {
  const [available, setAvailable] = React.useState(backendAvailable ?? false);

  React.useEffect(() => {
    let cancelled = false;
    void fetchBackendHealth()
      .then((res) => {
        if (cancelled) return;
        backendAvailable = res.database;
        setAvailable(res.database);
      })
      .catch(() => {
        if (cancelled) return;
        backendAvailable = false;
        setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}

/** Syncs server-side portfolio, balances, and adjustments into local stores. */
export function useBackendUserSync(): void {
  const { address } = useAccount();
  const backend = useBackendAvailable();
  const applyBalanceAdjustment = useStakingStore((s) => s.applyBalanceAdjustment);
  const setMyReferrer = useReferralsStore((s) => s.setMyReferrer);
  const { t } = useI18n();
  const lastSyncRef = React.useRef(0);
  const appliedIdsRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (!backend || !address) return;

    let cancelled = false;

    async function sync() {
      try {
        const [me, portfolioRes] = await Promise.all([
          fetchCurrentUser(),
          fetchUserPortfolio(),
          syncTradesFromServer(),
        ]);
        if (cancelled || !me.backend || !me.user) return;

        if (me.user.referrerWallet) {
          setMyReferrer({
            wallet: me.user.referrerWallet,
            displayName:
              me.user.referrerUsername?.trim() ||
              shortenAddress(me.user.referrerWallet),
          });
        } else {
          setMyReferrer(null);
        }

        if (portfolioRes.backend && portfolioRes.portfolio) {
          hydratePortfolioFromServer(
            portfolioRes.portfolio as import("@/lib/staking/portfolio-types").PortfolioDto,
          );
        } else {
          useStakingStore.setState({
            earningsBalance: me.user.earningsBalance,
            totalEarned: me.user.totalEarned,
          });
        }

        const since = lastSyncRef.current;
        const { adjustments } = await fetchBalanceAdjustments(since);
        if (cancelled) return;

        const portfolioSynced = portfolioRes.backend && portfolioRes.portfolio;

        for (const adj of adjustments) {
          if (appliedIdsRef.current.has(adj.id)) continue;

          const alreadyRecorded = useStakingStore
            .getState()
            .balanceAdjustments.some((b) => b.id === adj.id);

          if (!portfolioSynced) {
            if (alreadyRecorded) {
              appliedIdsRef.current.add(adj.id);
              continue;
            }
            applyBalanceAdjustment({
              id: adj.id,
              amount: adj.amount,
              note: adj.note,
              target: adj.target ?? "WITHDRAWABLE",
            });
          } else if (!alreadyRecorded) {
            useStakingStore.setState((s) => ({
              balanceAdjustments: [
                {
                  id: adj.id,
                  amount: adj.amount,
                  note: adj.note,
                  createdAt: new Date(adj.createdAt).getTime(),
                  target: adj.target ?? "WITHDRAWABLE",
                },
                ...s.balanceAdjustments,
              ].slice(0, 200),
            }));
          }

          appliedIdsRef.current.add(adj.id);
          const isCredit = adj.amount >= 0;
          const amountLabel = formatNumber(Math.abs(adj.amount), { decimals: 2 });
          const noteSuffix = adj.note.trim()
            ? t("notifications.events.adjustmentNoteSuffix", { note: adj.note.trim() })
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

        lastSyncRef.current = Date.now();
      } catch {
        // offline / unauthorized — keep local simulation
      }
    }

    void sync();
    const timer = window.setInterval(() => void sync(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [backend, address, applyBalanceAdjustment, setMyReferrer, t]);
}
