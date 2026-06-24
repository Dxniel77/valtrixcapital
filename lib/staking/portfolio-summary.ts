"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { useReferralsStore } from "@/lib/referrals/store";
import { utcDayKey } from "@/lib/trade/constants";
import { useTradeStore } from "@/lib/trade/store";
import {
  computeDailyRate,
  PAYOUT_CAP_MULTIPLIER,
  stakeEligibleForPassiveYieldNow,
  useStakingStore,
  type DailyYield,
  type InstantCredit,
  type Stake,
} from "@/lib/staking/store";
import { useWalletStore } from "@/lib/wallet/store";
import { showDailyEarningsBar } from "@/lib/staking/capital-profile";

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

/** Operaciones line on the portfolio progress card. */
export function portfolioOperationalDisplay(
  breakdown: Pick<
    CapEarningsBreakdown,
    "operationalEarned" | "operationalPendingToday"
  >,
): number {
  return round2(breakdown.operationalEarned + breakdown.operationalPendingToday);
}

/** Pasivo line on the portfolio progress card. */
export function portfolioPassiveDisplay(
  breakdown: Pick<
    CapEarningsBreakdown,
    "passiveEarned" | "passiveProjectedToday"
  >,
): number {
  return round2(breakdown.passiveEarned + breakdown.passiveProjectedToday);
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
  const creditedTotalEarned = fromParts;

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

export function usePortfolioSummary(): PortfolioSummary {
  const stakes = useStakingStore((s) => s.stakes);
  const storedTotalEarned = useStakingStore((s) => s.totalEarned);
  const earningsBalance = useStakingStore((s) => s.earningsBalance);
  const dailyYields = useStakingStore((s) => s.dailyYields);
  const instantCredits = useStakingStore((s) => s.instantCredits);
  const totalCommissions = useReferralsStore((s) => s.totalCommissions);
  const withdrawals = useWalletStore((s) => s.withdrawals);
  const preview = useTodayYieldPreview();
  const hasActiveCapital = stakes.some((s) => s.status === "ACTIVE");
  const showEarningsUi = showDailyEarningsBar({ hasActiveCapital });

  return React.useMemo(() => {
    const reconciled = reconcileCapEarnings({
      dailyYields,
      instantCredits,
      totalCommissions,
      storedTotalEarned,
    });
    const today = utcDayKey();
    const todayAlreadyAccrued = dailyYields.some((y) => y.date === today);
    const passiveProjectedToday =
      showEarningsUi && !todayAlreadyAccrued ? preview.projectedBaseAmount : 0;
    const breakdown: CapEarningsBreakdown = {
      passiveEarned: showEarningsUi ? reconciled.passiveEarned : 0,
      operationalEarned: showEarningsUi ? reconciled.operationalEarned : 0,
      networkEarned: showEarningsUi ? reconciled.networkEarned : 0,
      passiveProjectedToday: round2(passiveProjectedToday),
      operationalPendingToday: 0,
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
    totalCommissions,
    withdrawals,
    preview.projectedBaseAmount,
    showEarningsUi,
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
  const hasActiveCapital = stakes.some((s) => s.status === "ACTIVE");
  const showEarningsUi = showDailyEarningsBar({ hasActiveCapital });
  return React.useMemo(() => {
    const today = utcDayKey();
    let capital = stakes
      .filter((s) => stakeEligibleForPassiveYieldNow(s))
      .reduce((acc, s) => acc + s.amount, 0);
    if (!showEarningsUi) capital = 0;
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
  }, [stakes, todayTradeStats, showEarningsUi]);
}
