"use client";

import { refreshReferralsSnapshot } from "@/lib/hooks/use-referrals-sync";
import { ApiError, fetchCurrentUser, fetchUserTrades, openTradeOnServer, resolveTradeOnServer } from "@/lib/api/client";
import {
  hydrateTradesFromServer,
  mapServerTradeToPosition,
} from "@/lib/trade/hydrate-trades";
import type { TradeDto } from "@/lib/trade/trade-types";
import { useTradeStore } from "@/lib/trade/store";
import { useStakingStore } from "@/lib/staking/store";
import { syncOperationalCreditsFromTrades } from "@/lib/staking/operational-credits";

export async function syncTradesFromServer(): Promise<TradeDto[]> {
  const res = await fetchUserTrades();
  if (res.backend && res.trades.length >= 0) {
    hydrateTradesFromServer(res.trades);
  }
  return res.trades;
}

export async function openTradeWithBackend(input: {
  pair: string;
  direction: "UP" | "DOWN";
  entryPrice: number;
  durationSec: number;
}): Promise<TradeDto> {
  const res = await openTradeOnServer(input);
  const pos = mapServerTradeToPosition(res.trade);
  useTradeStore.setState((s) => ({
    positions: [pos, ...s.positions.filter((p) => p.id !== res.trade.id)],
  }));
  return res.trade;
}

export async function resolveTradeWithBackend(
  tradeId: string,
  exitPrice: number,
): Promise<TradeDto> {
  const res = await resolveTradeOnServer(tradeId, exitPrice);
  const pos = mapServerTradeToPosition(res.trade);
  useTradeStore.setState((s) => ({
    positions: s.positions.map((p) => (p.id === tradeId ? pos : p)),
  }));

  if (res.trade.status === "WIN") {
    const trades = await syncTradesFromServer();
    syncOperationalCreditsFromTrades(trades);

    try {
      const me = await fetchCurrentUser();
      if (me.user) {
        useStakingStore.setState({
          earningsBalance: me.user.earningsBalance,
          totalEarned: me.user.totalEarned,
        });
      }
    } catch {
      // portfolio sync will catch up
    }

    void refreshReferralsSnapshot();
  }

  return res.trade;
}

export function tradeErrorMessage(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  switch (err.payload.code) {
    case "NO_CAPITAL":
      return "NO_CAPITAL";
    case "DAILY_LIMIT":
      return "DAILY_LIMIT";
    case "SIMULTANEOUS_LIMIT":
      return "SIMULTANEOUS_LIMIT";
    case "HEDGE_BLOCKED":
      return "HEDGE_BLOCKED";
    default:
      return err.payload.error ?? null;
  }
}
