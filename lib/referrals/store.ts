"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useStakingStore, useStakingStoreHydrated } from "@/lib/staking/store";
import { utcDayKey } from "@/lib/trade/store";
import { getPlatformSettings } from "@/lib/platform/settings-store";
import {
  MIN_ACTIVE_CAPITAL_USDT,
  REFERRAL_LEVELS,
} from "./constants";
import {
  buildLevelStats,
  commissionFromYield,
  simulateDownlineDailyYield,
} from "./commission";

export interface DownlineMember {
  id: string;
  level: number;
  wallet: string;
  displayName: string;
  isActive: boolean;
  capital: number;
  joinedAt: number;
  commissionsPaidToYou: number;
  directReferrals: number;
  networkReferrals: number;
  totalEarned: number;
}

export interface CommissionRecord {
  id: string;
  level: number;
  sourceWallet: string;
  sourceYieldId: string;
  yieldDate: string;
  rateBps: number;
  amount: number;
  createdAt: number;
}

export interface ReferralLevelStats {
  level: number;
  rateBps: number;
  total: number;
  active: number;
  earned: number;
}

export interface MyReferrer {
  wallet: string;
  displayName: string;
}

interface ReferralsState {
  referralCode: string | null;
  myReferrer: MyReferrer | null;
  downline: DownlineMember[];
  commissions: CommissionRecord[];
  processedYieldIds: string[];
  totalCommissions: number;
  pendingNetworkEarnings: number;
  lastNetworkPayoutDay: string | null;

  ensureCode: (walletAddress?: string) => string;
  setMyReferrer: (referrer: MyReferrer | null) => void;
  seedDemoNetwork: () => void;
  processCommissionsForYields: (
    yields: { id: string; date: string; creditedAmount: number }[],
  ) => void;
  payoutNetworkEarnings: () => number;
  reset: () => void;
}

const initial = {
  referralCode: null as string | null,
  myReferrer: null as MyReferrer | null,
  downline: [] as DownlineMember[],
  commissions: [] as CommissionRecord[],
  processedYieldIds: [] as string[],
  totalCommissions: 0,
  pendingNetworkEarnings: 0,
  lastNetworkPayoutDay: null as string | null,
};

function makeId(prefix: string): string {
  const rand =
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}_${rand.replace(/-/g, "").slice(0, 12)}`;
}

function codeFromWallet(addr: string): string {
  const clean = addr.replace(/^0x/i, "").toUpperCase();
  return `VX${clean.slice(-6)}`;
}

function randomWallet(): string {
  let h = "0x";
  for (let i = 0; i < 40; i += 1) {
    h += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  }
  return h;
}

function buildDemoDownline(): DownlineMember[] {
  const counts = [2, 3, 4, 5, 6, 7, 8, 9];
  const members: DownlineMember[] = [];
  let seed = 0;
  for (let level = 1; level <= REFERRAL_LEVELS; level += 1) {
    for (let i = 0; i < counts[level - 1]; i += 1) {
      seed += 1;
      const capital =
        level <= 2
          ? 800 + seed * 120
          : level <= 4
            ? 250 + seed * 40
            : 50 + seed * 15;
      const isActive = capital >= MIN_ACTIVE_CAPITAL_USDT && seed % 4 !== 0;
      const directReferrals =
        level < REFERRAL_LEVELS ? Math.max(0, (counts[level] ?? 1) - i) : 0;
      const networkReferrals =
        level < REFERRAL_LEVELS
          ? Math.max(0, counts.slice(level).reduce((a, c) => a + c, 0) - directReferrals - 1)
          : 0;
      const invested = isActive ? capital : 0;
      members.push({
        id: makeId("ref"),
        level,
        wallet: randomWallet(),
        displayName: `Investor${seed}`,
        isActive,
        capital: invested,
        joinedAt: Date.now() - seed * 86_400_000 * 3,
        commissionsPaidToYou: 0,
        directReferrals: isActive ? directReferrals : 0,
        networkReferrals: isActive ? networkReferrals : 0,
        totalEarned: isActive ? invested * 0.12 + seed * 8.5 : 0,
      });
    }
  }
  return members;
}

export const useReferralsStore = create<ReferralsState>()(
  persist(
    (set, get) => ({
      ...initial,

      ensureCode: (walletAddress) => {
        get().seedDemoNetwork();
        const existing = get().referralCode;
        if (existing) return existing;
        const code = walletAddress
          ? codeFromWallet(walletAddress)
          : `VX${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        set({ referralCode: code });
        return code;
      },

      setMyReferrer: (referrer) => set({ myReferrer: referrer }),

      seedDemoNetwork: () => {
        const current = get().downline;
        if (current.length === 0) {
          set({ downline: buildDemoDownline() });
          return;
        }
        if (
          current.some(
            (m) =>
              !m.displayName ||
              m.directReferrals === undefined ||
              m.networkReferrals === undefined ||
              m.totalEarned === undefined,
          )
        ) {
          set({
            downline: current.map((m, i) => ({
              ...m,
              displayName: m.displayName ?? `Investor${i + 1}`,
              directReferrals: m.directReferrals ?? (m.level === 1 ? 1 : 0),
              networkReferrals:
                m.networkReferrals ?? Math.max(0, REFERRAL_LEVELS - m.level),
              totalEarned:
                m.totalEarned ??
                (m.isActive ? m.capital * 0.12 + (i + 1) * 8.5 : 0),
            })),
          });
        }
      },

      processCommissionsForYields: (yields) => {
        if (yields.length === 0) return;
        const state = get();
        if (state.downline.length === 0) state.seedDemoNetwork();

        const processed = new Set(state.processedYieldIds);
        const newCommissions: CommissionRecord[] = [];
        const downline = state.downline.map((m) => ({ ...m }));
        let creditTotal = 0;

        for (const y of yields) {
          if (processed.has(y.id)) continue;
          processed.add(y.id);

          for (const member of downline) {
            if (!member.isActive || member.capital <= 0) continue;
            const downlineYield = simulateDownlineDailyYield(
              member.capital,
              member.level * 7 + member.wallet.length,
            );
            const amount = commissionFromYield(downlineYield, member.level);
            if (amount <= 0) continue;

            newCommissions.push({
              id: makeId("com"),
              level: member.level,
              sourceWallet: member.wallet,
              sourceYieldId: y.id,
              yieldDate: y.date,
              rateBps: getPlatformSettings().commissionRatesBps[member.level - 1] ?? 0,
              amount,
              createdAt: Date.now(),
            });

            const idx = downline.findIndex((d) => d.id === member.id);
            if (idx >= 0) {
              downline[idx].commissionsPaidToYou += amount;
            }
            creditTotal += amount;
          }
        }

        if (newCommissions.length === 0) {
          set({ processedYieldIds: [...processed] });
          return;
        }

        const mergedCommissions = [
          ...newCommissions,
          ...state.commissions,
        ].slice(0, 200);

        set({
          downline,
          commissions: mergedCommissions,
          processedYieldIds: [...processed],
          totalCommissions: state.totalCommissions + creditTotal,
          pendingNetworkEarnings: state.pendingNetworkEarnings + creditTotal,
        });

        if (creditTotal > 0) {
          get().payoutNetworkEarnings();
        }
      },

      payoutNetworkEarnings: () => {
        const state = get();
        if (state.pendingNetworkEarnings <= 0) return 0;

        const today = utcDayKey();
        if (state.lastNetworkPayoutDay === today) return 0;

        const amount = state.pendingNetworkEarnings;
        const credited = useStakingStore.getState().creditNetworkPayout(amount);
        if (credited <= 0) return 0;

        set({
          pendingNetworkEarnings: Math.max(0, amount - credited),
          lastNetworkPayoutDay: today,
        });
        return credited;
      },

      reset: () => set(initial),
    }),
    {
      name: "valtrix.referrals.v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : window.localStorage,
      ),
      partialize: (s) => ({
        referralCode: s.referralCode,
        myReferrer: s.myReferrer,
        downline: s.downline,
        commissions: s.commissions,
        processedYieldIds: s.processedYieldIds,
        totalCommissions: s.totalCommissions,
        pendingNetworkEarnings: s.pendingNetworkEarnings,
        lastNetworkPayoutDay: s.lastNetworkPayoutDay,
      }),
    },
  ),
);

export function useReferralsStoreHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const unsub = useReferralsStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useReferralsStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

export function useReferralLevelStats(): ReferralLevelStats[] {
  const downline = useReferralsStore((s) => s.downline);
  return React.useMemo(() => buildLevelStats(downline), [downline]);
}

export function referralLink(code: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/sign-in?ref=${encodeURIComponent(code)}`;
}

/**
 * Commission engine: whenever the staking yield engine writes new
 * `DailyYieldRecord`s, credit the upline (this user) with commissions from
 * each active downline member's simulated daily yield.
 */
export function useCommissionEngine(): void {
  const hydrated = useReferralsStoreHydrated();
  const stakingHydrated = useStakingStoreHydrated();
  const dailyYields = useStakingStore((s) => s.dailyYields);
  const process = useReferralsStore((s) => s.processCommissionsForYields);

  React.useEffect(() => {
    if (!hydrated || !stakingHydrated) return;
    if (dailyYields.length === 0) return;
    process(
      dailyYields.map((y) => ({
        id: y.id,
        date: y.date,
        creditedAmount: y.creditedAmount,
      })),
    );
  }, [hydrated, stakingHydrated, dailyYields, process]);
}

/** Pays accumulated network commissions to withdrawable balance every UTC day. */
export function useNetworkPayoutEngine(): void {
  const hydrated = useReferralsStoreHydrated();
  const stakingHydrated = useStakingStoreHydrated();
  const payout = useReferralsStore((s) => s.payoutNetworkEarnings);
  const pending = useReferralsStore((s) => s.pendingNetworkEarnings);
  const dailyYields = useStakingStore((s) => s.dailyYields);

  React.useEffect(() => {
    if (!hydrated || !stakingHydrated) return;
    payout();
    const id = window.setInterval(payout, 60_000);
    return () => window.clearInterval(id);
  }, [hydrated, stakingHydrated, payout, pending, dailyYields]);
}
