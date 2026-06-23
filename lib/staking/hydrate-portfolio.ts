"use client";

import type { PortfolioDto } from "@/lib/staking/portfolio-types";
import {
  mapServerDailyYield,
  mapServerStake,
  mapServerWithdrawal,
} from "@/lib/staking/portfolio-types";
import type { PendingDeposit } from "@/lib/staking/store";
import { useStakingStore } from "@/lib/staking/store";
import { useWalletStore } from "@/lib/wallet/store";

function pendingDepositKey(pending: PendingDeposit | null | undefined): string | null {
  if (!pending) return null;
  return pending.serverDepositId ?? pending.id;
}

function pendingDepositsEqual(
  a: PendingDeposit | null,
  b: PendingDeposit | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    pendingDepositKey(a) === pendingDepositKey(b) &&
    a.amount === b.amount &&
    a.network === b.network &&
    a.txHash === b.txHash &&
    a.confirmations === b.confirmations &&
    a.requiredConfirmations === b.requiredConfirmations
  );
}

/** Applies a server portfolio snapshot into client Zustand stores. */
export function hydratePortfolioFromServer(portfolio: PortfolioDto): void {
  useStakingStore.setState((state) => ({
    earningsBalance: portfolio.earningsBalance,
    totalEarned: portfolio.totalEarned,
    stakes: portfolio.stakes.map(mapServerStake),
    pendingDeposit: pendingDepositsEqual(state.pendingDeposit, portfolio.pendingDeposit)
      ? state.pendingDeposit
      : portfolio.pendingDeposit,
    dailyYields: portfolio.dailyYields.map(mapServerDailyYield),
    lastAccrualDay: portfolio.dailyYields[0]?.date ?? state.lastAccrualDay,
  }));

  useWalletStore.setState({
    withdrawals: portfolio.withdrawals.map(mapServerWithdrawal),
  });
}
