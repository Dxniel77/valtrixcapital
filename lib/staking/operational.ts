"use client";

import * as React from "react";
import {
  usePlatformSettingsStore,
} from "@/lib/platform/settings-store";
import { useTradeStore, useTradeStoreHydrated } from "@/lib/trade/store";
import {
  activeCapital,
  useStakingStore,
} from "@/lib/staking/store";
import { useStakingStoreHydrated } from "@/lib/staking/yield-engine";

/**
 * Credits trade-win bonuses instantly when a position resolves as WIN
 * (Binance-style: profit visible as soon as the operation closes).
 */
export function useOperationalCreditEngine(): void {
  const tradeHydrated = useTradeStoreHydrated();
  const stakingHydrated = useStakingStoreHydrated();
  const positions = useTradeStore((s) => s.positions);
  const stakes = useStakingStore((s) => s.stakes);
  const creditedPositionIds = useStakingStore((s) => s.creditedPositionIds);
  const creditTradeWin = useStakingStore((s) => s.creditTradeWin);
  const bonusPerWinBps = usePlatformSettingsStore((s) => s.settings.bonusPerWinBps);

  React.useEffect(() => {
    if (!tradeHydrated || !stakingHydrated) return;

    const capital = activeCapital(stakes);
    if (capital <= 0) return;

    const bonusPerWin = (capital * bonusPerWinBps) / 10_000;
    if (bonusPerWin <= 0) return;

    for (const p of positions) {
      if (p.status !== "WIN" || !p.resolvedAt) continue;
      if (creditedPositionIds.includes(p.id)) continue;
      creditTradeWin(p.id, bonusPerWin);
    }
  }, [
    tradeHydrated,
    stakingHydrated,
    positions,
    stakes,
    creditedPositionIds,
    creditTradeWin,
    bonusPerWinBps,
  ]);
}
