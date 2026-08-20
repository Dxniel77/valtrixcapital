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
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { useUserRegistry } from "@/lib/user/store";
import { normalizeWallet } from "@/lib/user/validation";

/**
 * Shared backend-availability cache.
 *
 * `/api/health` used to be fetched independently by every component that called
 * `useBackendAvailable()` (~10 of them) on every mount and every navigation.
 * That meant a single dashboard page could fire `/api/health` 5–6 times, and it
 * re-fired on every route transition. We now resolve it ONCE per TTL window for
 * the whole app, deduping concurrent callers via a shared in-flight promise.
 */
const HEALTH_TTL_MS = 5 * 60_000;

let cachedHealth: { value: boolean; at: number } | null = null;
let inFlightHealth: Promise<boolean> | null = null;
const healthListeners = new Set<(value: boolean) => void>();

export function loadBackendAvailability(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && cachedHealth && now - cachedHealth.at < HEALTH_TTL_MS) {
    return Promise.resolve(cachedHealth.value);
  }
  if (inFlightHealth) return inFlightHealth;

  inFlightHealth = fetchBackendHealth()
    .then((res) => res.database)
    .catch(() => false)
    .then((value) => {
      cachedHealth = { value, at: Date.now() };
      healthListeners.forEach((listener) => listener(value));
      return value;
    })
    .finally(() => {
      inFlightHealth = null;
    });

  return inFlightHealth;
}

export function useBackendAvailable(): boolean {
  const [available, setAvailable] = React.useState(
    () => cachedHealth?.value ?? false,
  );

  React.useEffect(() => {
    let cancelled = false;
    const update = (value: boolean) => {
      if (!cancelled) setAvailable(value);
    };

    healthListeners.add(update);
    void loadBackendAvailability().then(update);

    return () => {
      cancelled = true;
      healthListeners.delete(update);
    };
  }, []);

  return available;
}

/** Syncs server-side portfolio, balances, and adjustments into local stores. */
export function useBackendUserSync(): void {
  const { address } = useAccount();
  const backend = useBackendAvailable();
  const visible = usePageVisible();
  const applyBalanceAdjustment = useStakingStore((s) => s.applyBalanceAdjustment);
  const setMyReferrer = useReferralsStore((s) => s.setMyReferrer);
  const upsertProfile = useUserRegistry((s) => s.upsertProfileFromServer);
  const { t } = useI18n();
  const lastSyncRef = React.useRef(0);
  const appliedIdsRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (!backend || !address || !visible) return;

    let cancelled = false;

    async function sync() {
      try {
        const me = await fetchCurrentUser();
        if (cancelled || !me.backend || !me.user) return;

        const portfolioRes = await fetchUserPortfolio();
        await syncTradesFromServer();

        if (me.user.username) {
          upsertProfile({
            id: me.user.id,
            wallet: normalizeWallet(me.user.walletAddress),
            username: me.user.username,
            joinedAt: Date.now(),
          });
        }

        const currentReferrer = useReferralsStore.getState().myReferrer;
        if (me.user.referrerWallet) {
          const nextReferrer = {
            wallet: me.user.referrerWallet,
            displayName:
              me.user.referrerUsername?.trim() ||
              shortenAddress(me.user.referrerWallet),
          };
          if (
            currentReferrer?.wallet !== nextReferrer.wallet ||
            currentReferrer.displayName !== nextReferrer.displayName
          ) {
            setMyReferrer(nextReferrer);
          }
        } else if (currentReferrer !== null) {
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

        useStakingStore.setState({
          realCapital: me.user.realCapital,
          companyCapital: me.user.companyCapital,
          accountGranted: me.user.accountGranted,
          capitalProfileSynced: true,
        });

        const since = lastSyncRef.current;
        const { adjustments } = await fetchBalanceAdjustments(since);
        if (cancelled) return;

        const portfolioSynced = portfolioRes.backend && portfolioRes.portfolio;

        for (const adj of adjustments) {
          if (appliedIdsRef.current.has(adj.id)) continue;

          const alreadyRecorded = useStakingStore
            .getState()
            .balanceAdjustments.some((b) => b.id === adj.id);

          if (adj.target === "COPY") {
            appliedIdsRef.current.add(adj.id);
            continue;
          }

          const stakingTarget: "WITHDRAWABLE" | "STAKING" =
            adj.target === "STAKING" ? "STAKING" : "WITHDRAWABLE";

          if (!portfolioSynced) {
            if (alreadyRecorded) {
              appliedIdsRef.current.add(adj.id);
              continue;
            }
            applyBalanceAdjustment({
              id: adj.id,
              amount: adj.amount,
              note: adj.note,
              target: stakingTarget,
            });
          } else if (!alreadyRecorded) {
            useStakingStore.setState((s) => ({
              balanceAdjustments: [
                {
                  id: adj.id,
                  amount: adj.amount,
                  note: adj.note,
                  createdAt: new Date(adj.createdAt).getTime(),
                  target: stakingTarget,
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
    const timer = window.setInterval(() => void sync(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [backend, address, visible, applyBalanceAdjustment, setMyReferrer, upsertProfile, t]);
}
