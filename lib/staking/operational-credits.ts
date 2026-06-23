"use client";

import type { TradeDto } from "@/lib/trade/trade-types";
import type { InstantCredit } from "@/lib/staking/store";
import { useStakingStore } from "@/lib/staking/store";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Bonus per resolved win from active capital and platform bps. */
export function bonusPerWinAmount(capital: number, bonusPerWinBps: number): number {
  if (capital <= 0 || bonusPerWinBps <= 0) return 0;
  return round2((capital * bonusPerWinBps) / 10_000);
}

/**
 * Rebuilds local instant trade-win credits from server trade rows.
 * Each win keeps the bonus credited at capital snapshot time (not current capital).
 */
export function syncOperationalCreditsFromTrades(trades: TradeDto[]): void {
  const instantCredits: InstantCredit[] = [];
  const creditedPositionIds: string[] = [];

  for (const trade of trades) {
    if (trade.status !== "WIN") continue;
    creditedPositionIds.push(trade.id);
    if (trade.bonusCredited <= 0) continue;

    instantCredits.push({
      id: `op_${trade.id}`,
      positionId: trade.id,
      amount: trade.bonusCredited,
      createdAt: trade.resolvedAt ?? trade.openedAt,
      type: "TRADE_WIN",
    });
  }

  instantCredits.sort((a, b) => b.createdAt - a.createdAt);

  useStakingStore.setState({ instantCredits, creditedPositionIds });
}

export function sumTradeWinBonuses(trades: TradeDto[]): number {
  return Math.round(
    trades
      .filter((t) => t.status === "WIN")
      .reduce((acc, t) => acc + t.bonusCredited, 0) * 100,
  ) / 100;
}
