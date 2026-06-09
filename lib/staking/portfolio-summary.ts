"use client";

import * as React from "react";
import { useReferralsStore } from "@/lib/referrals/store";
import {
  BONUS_PER_WIN_BPS,
  utcDayKey,
  useTradeStore,
} from "@/lib/trade/store";
import {
  activeCapital,
  computeDailyRate,
  PAYOUT_CAP_MULTIPLIER,
  useStakingStore,
  type DailyYield,
  type InstantCredit,
  type Stake,
} from "@/lib/staking/store";

export interface CapEarningsBreakdown {
  passiveEarned: number;
  operationalEarned: number;
  networkEarned: number;
}

export interface PortfolioSummary extends CapEarningsBreakdown {
  totalCapital: number;
  activeStakes: number;
  totalEarned: number;
  creditedTotalEarned: number;
  earningsBalance: number;
  payoutCap: number;
  capProgressPct: number;
  capProgressBarPct: number;
  daysActive: number;
  remainingToCap: number;
  isCapReached: boolean;
  firstStakeAt: number | null;
}

export interface TodayYieldPreview {
  date: string;
  capital: number;
  baseRateBps: number;
  bonusRateBps: number;
  totalRateBps: number;
  projectedAmount: number;
  wins: number;
  losses: number;
}

export function reconcileCapEarnings(input: {
  dailyYields: DailyYield[];
  instantCredits: InstantCredit[];
  totalCommissions: number;
  pendingNetworkEarnings: number;
  storedTotalEarned: number;
}): CapEarningsBreakdown & { creditedTotalEarned: number } {
  const passiveEarned = input.dailyYields.reduce(
    (acc, y) => acc + y.creditedAmount,
    0,
  );
  const operationalEarned = input.instantCredits.reduce(
    (acc, c) => acc + c.amount,
    0,
  );
  const networkEarned = input.totalCommissions;
  const fromParts = passiveEarned + operationalEarned + networkEarned;
  const creditedTotalEarned = Math.max(input.storedTotalEarned, fromParts);

  return {
    passiveEarned,
    operationalEarned,
    networkEarned,
    creditedTotalEarned,
  };
}

export function deriveSummary(input: {
  stakes: Stake[];
  earningsBalance: number;
  creditedTotalEarned: number;
  todayProjectedYield: number;
  breakdown: CapEarningsBreakdown;
}): PortfolioSummary {
  const active = input.stakes.filter((s) => s.status === "ACTIVE");
  const totalCapital = active.reduce((acc, s) => acc + s.amount, 0);
  const payoutCap = totalCapital * PAYOUT_CAP_MULTIPLIER;
  const totalEarned =
    payoutCap > 0
      ? Math.min(payoutCap, input.creditedTotalEarned + input.todayProjectedYield)
      : input.creditedTotalEarned + input.todayProjectedYield;
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
): number {
  const capital = activeCapital(stakes);
  if (capital <= 0) return 0;
  const bonusPerWin = (capital * BONUS_PER_WIN_BPS) / 10_000;
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
  const pendingNetworkEarnings = useReferralsStore(
    (s) => s.pendingNetworkEarnings,
  );
  const positions = useTradeStore((s) => s.positions);
  const preview = useTodayYieldPreview();

  return React.useMemo(() => {
    const { creditedTotalEarned, ...breakdown } = reconcileCapEarnings({
      dailyYields,
      instantCredits,
      totalCommissions,
      pendingNetworkEarnings,
      storedTotalEarned,
    });
    const today = utcDayKey();
    const todayAlreadyAccrued = dailyYields.some((y) => y.date === today);
    const todayProjectedYield = todayAlreadyAccrued
      ? 0
      : preview.projectedAmount;
    const pendingOps = pendingOperationalCredit(
      stakes,
      creditedPositionIds,
      positions,
    );

    return deriveSummary({
      stakes,
      earningsBalance,
      creditedTotalEarned,
      todayProjectedYield: todayProjectedYield + pendingOps,
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
    pendingNetworkEarnings,
    positions,
    preview.projectedAmount,
  ]);
}

export function useTodayYieldPreview(): TodayYieldPreview {
  const stakes = useStakingStore((s) => s.stakes);
  const positions = useTradeStore((s) => s.positions);
  return React.useMemo(() => {
    const today = utcDayKey();
    const capital = stakes
      .filter(
        (s) =>
          s.status === "ACTIVE" &&
          utcDayKey(s.confirmedAt ?? s.createdAt) < today,
      )
      .reduce((acc, s) => acc + s.amount, 0);
    const todays = positions.filter(
      (p) => utcDayKey(p.openedAt) === today && p.status !== "OPEN",
    );
    const wins = todays.filter((p) => p.status === "WIN").length;
    const losses = todays.filter((p) => p.status === "LOSS").length;
    const rate = computeDailyRate(wins);
    const projectedAmount = (capital * rate.totalRateBps) / 10_000;
    return {
      date: today,
      capital,
      baseRateBps: rate.baseRateBps,
      bonusRateBps: rate.bonusRateBps,
      totalRateBps: rate.totalRateBps,
      projectedAmount,
      wins,
      losses,
    };
  }, [stakes, positions]);
}
