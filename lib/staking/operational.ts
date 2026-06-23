"use client";

import * as React from "react";
import { usePlatformSettingsStore } from "@/lib/platform/settings-store";
import { useTradeStore, useTradeStoreHydrated } from "@/lib/trade/store";
import { activeCapital, useStakingStore, type Stake } from "@/lib/staking/store";
import { useStakingStoreHydrated } from "@/lib/staking/yield-engine";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { allowOfflineSimulation } from "@/lib/runtime-mode";
import { bonusPerWinAmount } from "@/lib/staking/operational-credits";

function capitalAtTime(stakes: Stake[], atMs: number): number {
  return stakes
    .filter((s) => {
      if (s.status !== "ACTIVE" && s.status !== "COMPLETED") return false;
      const confirmed = s.confirmedAt ?? s.createdAt;
      return confirmed <= atMs;
    })
    .reduce((acc, s) => acc + s.amount, 0);
}

/**
 * Credits trade-win bonuses instantly when a position resolves as WIN
 * (local demo only — server credits wins in POST /api/trades/[id]/resolve).
 */
export function useOperationalCreditEngine(): void {
  const backend = useBackendAvailable();
  const tradeHydrated = useTradeStoreHydrated();
  const stakingHydrated = useStakingStoreHydrated();
  const positions = useTradeStore((s) => s.positions);
  const stakes = useStakingStore((s) => s.stakes);
  const creditedPositionIds = useStakingStore((s) => s.creditedPositionIds);
  const creditTradeWin = useStakingStore((s) => s.creditTradeWin);
  const bonusPerWinBps = usePlatformSettingsStore((s) => s.settings.bonusPerWinBps);

  React.useEffect(() => {
    if (backend || !allowOfflineSimulation() || !tradeHydrated || !stakingHydrated) return;

    for (const p of positions) {
      if (p.status !== "WIN" || !p.resolvedAt) continue;
      if (creditedPositionIds.includes(p.id)) continue;

      const capital = capitalAtTime(stakes, p.resolvedAt);
      const bonusPerWin = bonusPerWinAmount(capital, bonusPerWinBps);
      if (bonusPerWin <= 0) continue;

      creditTradeWin(p.id, bonusPerWin);
    }
  }, [
    backend,
    tradeHydrated,
    stakingHydrated,
    positions,
    stakes,
    creditedPositionIds,
    creditTradeWin,
    bonusPerWinBps,
  ]);
}
