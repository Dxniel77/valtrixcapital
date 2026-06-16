"use client";

import type { PortfolioDto } from "@/lib/staking/portfolio-types";
import {
  mapServerDailyYield,
  mapServerStake,
  mapServerWithdrawal,
} from "@/lib/staking/portfolio-types";
import { useStakingStore } from "@/lib/staking/store";
import { useWalletStore } from "@/lib/wallet/store";

/** Applies a server portfolio snapshot into client Zustand stores. */
export function hydratePortfolioFromServer(portfolio: PortfolioDto): void {
  useStakingStore.setState((state) => ({
    earningsBalance: portfolio.earningsBalance,
    totalEarned: portfolio.totalEarned,
    stakes: portfolio.stakes.map(mapServerStake),
    pendingDeposit: portfolio.pendingDeposit,
    dailyYields: portfolio.dailyYields.map(mapServerDailyYield),
    lastAccrualDay: portfolio.dailyYields[0]?.date ?? state.lastAccrualDay,
  }));

  useWalletStore.setState({
    withdrawals: portfolio.withdrawals.map(mapServerWithdrawal),
  });
}
