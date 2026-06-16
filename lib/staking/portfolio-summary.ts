"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { useReferralsStore } from "@/lib/referrals/store";
import { usePlatformSettings } from "@/lib/platform/settings-store";
import { utcDayKey } from "@/lib/trade/constants";
import { useTradeStore } from "@/lib/trade/store";
import {
  activeCapital,
  computeDailyRate,
  PAYOUT_CAP_MULTIPLIER,
  stakeEligibleForPassiveYieldNow,
  useStakingStore,
  type DailyYield,
  type InstantCredit,
  type Stake,
} from "@/lib/staking/store";
import { useWalletStore } from "@/lib/wallet/store";

export interface CapEarningsBreakdown {
  /** Passive yield already credited (daily accruals). */
  passiveEarned: number;
  /** Trade-win bonuses already credited. */
  operationalEarned: number;
  /** Network commissions earned (lifetime). */
  networkEarned: number;
  /** Today's base passive not yet booked at UTC midnight. */
  passiveProjectedToday: number;
  /** Resolved wins today not yet credited as operational. */
  operationalPendingToday: number;
}

export interface PortfolioSummary extends CapEarningsBreakdown {
  totalCapital: number;
  activeStakes: number;
  /** Gross credited + today's pending — toward 200% cap (not reduced by withdrawals). */
  totalEarned: number;
  creditedTotalEarned: number;
  earningsBalance: number;
  /** Lifetime withdrawals reserved or completed (excludes rejected). */
  totalWithdrawn: number;
  payoutCap: number;
  capProgressPct: number;
  capProgressBarPct: number;
  daysActive: number;
  remainingToCap: number;
  isCapReached: boolean;
  firstStakeAt: number | null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Sum of all earnings buckets shown in the portfolio breakdown. */
export function grossEarnedTotal(breakdown: CapEarningsBreakdown): number {
  return round2(
    breakdown.passiveEarned +
      breakdown.operationalEarned +
      breakdown.networkEarned +
      breakdown.passiveProjectedToday +
      breakdown.operationalPendingToday,
  );
}

export interface TodayYieldPreview {
  date: string;
  capital: number;
  baseRateBps: number;
  bonusRateBps: number;
  totalRateBps: number;
  /** Base passive only (0.3% of capital) — used for poster "ganancia base". */
  projectedBaseAmount: number;
  /** Win bonuses credited instantly as operational yield (0.1% × wins). */
  projectedBonusAmount: number;
  /** Total daily yield (base + bonuses) — dashboard headline. */
  projectedAmount: number;
  wins: number;
  losses: number;
}

export function reconcileCapEarnings(input: {
  dailyYields: DailyYield[];
  instantCredits: InstantCredit[];
  totalCommissions: number;
  storedTotalEarned: number;
}): Pick<
  CapEarningsBreakdown,
  "passiveEarned" | "operationalEarned" | "networkEarned"
> & { creditedTotalEarned: number } {
  const passiveEarned = input.dailyYields.reduce(
    (acc, y) => acc + y.creditedAmount,
    0,
  );
  const operationalEarned = input.instantCredits.reduce(
    (acc, c) => acc + c.amount,
    0,
  );
  const networkEarned = input.totalCommissions;
  const fromParts = round2(
    passiveEarned + operationalEarned + networkEarned,
  );
  const creditedTotalEarned = Math.max(input.storedTotalEarned, fromParts);

  return {
    passiveEarned: round2(passiveEarned),
    operationalEarned: round2(operationalEarned),
    networkEarned: round2(networkEarned),
    creditedTotalEarned,
  };
}

export function deriveSummary(input: {
  stakes: Stake[];
  earningsBalance: number;
  creditedTotalEarned: number;
  totalWithdrawn: number;
  breakdown: CapEarningsBreakdown;
}): PortfolioSummary {
  const active = input.stakes.filter((s) => s.status === "ACTIVE");
  const totalCapital = active.reduce((acc, s) => acc + s.amount, 0);
  const payoutCap = totalCapital * PAYOUT_CAP_MULTIPLIER;
  const grossEarned = grossEarnedTotal(input.breakdown);
  const totalEarned =
    payoutCap > 0 ? Math.min(payoutCap, grossEarned) : grossEarned;
  const capProgressPct =
    totalCapital > 0
      ? Math.min(
          PAYOUT_CAP_MULTIPLIER * 100,
          (totalEarned / totalCapital) * 100,
        )
      : 0;
  const capProgressBarPct = Math.min(
    100,
    capProgressPct / PAYOUT_CAP_MULTIPLIER,
  );
  const firstStakeAt = active.reduce<number | null>((acc, s) => {
    const ts = s.confirmedAt ?? s.createdAt;
    return acc === null || ts < acc ? ts : acc;
  }, null);
  const daysActive = firstStakeAt
    ? Math.max(0, Math.floor((Date.now() - firstStakeAt) / 86_400_000))
    : 0;

  return {
    totalCapital,
    activeStakes: active.length,
    totalEarned,
    creditedTotalEarned: input.creditedTotalEarned,
    earningsBalance: input.earningsBalance,
    totalWithdrawn: input.totalWithdrawn,
    payoutCap,
    capProgressPct,
    capProgressBarPct,
    daysActive,
    remainingToCap: Math.max(0, payoutCap - totalEarned),
    isCapReached: payoutCap > 0 && totalEarned >= payoutCap,
    firstStakeAt,
    ...input.breakdown,
  };
}

function pendingOperationalCredit(
  stakes: Stake[],
  creditedPositionIds: string[],
  positions: { id: string; status: string }[],
  bonusPerWinBps: number,
): number {
  const capital = activeCapital(stakes);
  if (capital <= 0) return 0;
  const bonusPerWin = (capital * bonusPerWinBps) / 10_000;
  const pendingWins = positions.filter(
    (p) => p.status === "WIN" && !creditedPositionIds.includes(p.id),
  ).length;
  return pendingWins * bonusPerWin;
}

export function usePortfolioSummary(): PortfolioSummary {
  const stakes = useStakingStore((s) => s.stakes);
  const storedTotalEarned = useStakingStore((s) => s.totalEarned);
  const earningsBalance = useStakingStore((s) => s.earningsBalance);
  const dailyYields = useStakingStore((s) => s.dailyYields);
  const instantCredits = useStakingStore((s) => s.instantCredits);
  const creditedPositionIds = useStakingStore((s) => s.creditedPositionIds);
  const totalCommissions = useReferralsStore((s) => s.totalCommissions);
  const withdrawals = useWalletStore((s) => s.withdrawals);
  const positionOutcomes = useTradeStore(
    useShallow((s) =>
      s.positions.map((p) => ({
        id: p.id,
        status: p.status,
        openedAt: p.openedAt,
      })),
    ),
  );
  const preview = useTodayYieldPreview();
  const { bonusPerWinBps } = usePlatformSettings();

  return React.useMemo(() => {
    const reconciled = reconcileCapEarnings({
      dailyYields,
      instantCredits,
      totalCommissions,
      storedTotalEarned,
    });
    const today = utcDayKey();
    const todayAlreadyAccrued = dailyYields.some((y) => y.date === today);
    const passiveProjectedToday = todayAlreadyAccrued
      ? 0
      : preview.projectedBaseAmount;
    const operationalPendingToday = pendingOperationalCredit(
      stakes,
      creditedPositionIds,
      positionOutcomes,
      bonusPerWinBps,
    );
    const breakdown: CapEarningsBreakdown = {
      passiveEarned: reconciled.passiveEarned,
      operationalEarned: reconciled.operationalEarned,
      networkEarned: reconciled.networkEarned,
      passiveProjectedToday: round2(passiveProjectedToday),
      operationalPendingToday: round2(operationalPendingToday),
    };
    const totalWithdrawn = withdrawals
      .filter((w) => w.status !== "REJECTED")
      .reduce((acc, w) => acc + w.amount, 0);

    return deriveSummary({
      stakes,
      earningsBalance,
      creditedTotalEarned: reconciled.creditedTotalEarned,
      totalWithdrawn: round2(totalWithdrawn),
      breakdown,
    });
  }, [
    stakes,
    storedTotalEarned,
    earningsBalance,
    dailyYields,
    instantCredits,
    creditedPositionIds,
    totalCommissions,
    withdrawals,
    positionOutcomes,
    preview.projectedBaseAmount,
    bonusPerWinBps,
  ]);
}

export function useTodayYieldPreview(): TodayYieldPreview {
  const stakes = useStakingStore((s) => s.stakes);
  const todayTradeStats = useTradeStore(
    useShallow((s) => {
      const today = utcDayKey();
      let wins = 0;
      let losses = 0;
      for (const p of s.positions) {
        if (utcDayKey(p.openedAt) !== today || p.status === "OPEN") continue;
        if (p.status === "WIN") wins += 1;
        else if (p.status === "LOSS") losses += 1;
      }
      return { wins, losses };
    }),
  );
  const { baseYieldBps, bonusPerWinBps, maxDailyYieldBps } = usePlatformSettings();
  return React.useMemo(() => {
    const today = utcDayKey();
    const capital = stakes
      .filter((s) => stakeEligibleForPassiveYieldNow(s))
      .reduce((acc, s) => acc + s.amount, 0);
    const { wins, losses } = todayTradeStats;
    const rate = computeDailyRate(wins);
    const projectedBaseAmount = (capital * rate.baseRateBps) / 10_000;
    const projectedBonusAmount = (capital * rate.bonusRateBps) / 10_000;
    return {
      date: today,
      capital,
      baseRateBps: rate.baseRateBps,
      bonusRateBps: rate.bonusRateBps,
      totalRateBps: rate.totalRateBps,
      projectedBaseAmount,
      projectedBonusAmount,
      projectedAmount: projectedBaseAmount + projectedBonusAmount,
      wins,
      losses,
    };
  }, [stakes, todayTradeStats, baseYieldBps, bonusPerWinBps, maxDailyYieldBps]);
}
