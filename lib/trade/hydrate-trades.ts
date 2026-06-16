"use client";

import type { Position } from "@/lib/trade/constants";
import type { TradeDto } from "@/lib/trade/trade-types";
import { utcDayKey } from "@/lib/trade/constants";
import { useTradeStore } from "@/lib/trade/store";

export function mapServerTradeToPosition(trade: TradeDto): Position {
  return {
    id: trade.id,
    pair: trade.pair,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice ?? undefined,
    durationSec: trade.durationSec,
    openedAt: trade.openedAt,
    resolvedAt: trade.resolvedAt ?? undefined,
    status: trade.status === "OPEN" ? "OPEN" : trade.status,
  };
}

/** Replaces local trade positions with the server snapshot. */
export function hydrateTradesFromServer(trades: TradeDto[]): void {
  const positions = trades.map(mapServerTradeToPosition);
  const utcDay = utcDayKey();
  useTradeStore.setState({ positions, utcDay });
}
