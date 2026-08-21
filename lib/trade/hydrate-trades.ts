"use client";

import type { Position } from "@/lib/trade/constants";
import type { TradeDto } from "@/lib/trade/trade-types";
import { utcDayKey } from "@/lib/trade/constants";
import { syncOperationalCreditsFromTrades } from "@/lib/staking/operational-credits";
import { getPlatformSettings } from "@/lib/platform/settings-store";
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

/** Maps local positions to trade DTOs for operational credit sync. */
export function positionsToTradeDtos(
  positions: Position[],
  resolved?: TradeDto,
): TradeDto[] {
  const defaultBonusBps = getPlatformSettings().bonusPerWinBps;
  return positions.map((p) => {
    if (resolved && p.id === resolved.id) return resolved;
    return {
      id: p.id,
      pair: p.pair,
      direction: p.direction,
      entryPrice: p.entryPrice,
      exitPrice: p.exitPrice ?? null,
      durationSec: p.durationSec,
      openedAt: p.openedAt,
      expiresAt: p.openedAt + p.durationSec * 1000,
      resolvedAt: p.resolvedAt ?? null,
      status: p.status,
      bonusAppliedBps: p.status === "WIN" ? defaultBonusBps : 0,
      capitalSnapshotAtWin: 0,
      bonusCredited: 0,
    };
  });
}

/** Replaces local trade positions with the server snapshot. */
export function hydrateTradesFromServer(trades: TradeDto[]): void {
  const positions = trades.map(mapServerTradeToPosition);
  const utcDay = utcDayKey();
  useTradeStore.setState({ positions, utcDay });
  syncOperationalCreditsFromTrades(trades);
}
