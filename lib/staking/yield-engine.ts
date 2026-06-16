"use client";

import * as React from "react";
import { useTradeStore, useTradeStoreHydrated } from "@/lib/trade/store";
import { useStakingStore } from "@/lib/staking/store";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";

/** Returns `true` once Zustand has loaded persisted state from localStorage. */
export function useStakingStoreHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const unsub = useStakingStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useStakingStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

/**
 * Local yield accrual when backend is offline.
 * When Postgres is connected, daily yield runs via `/api/cron/daily-yield`.
 */
export function useYieldEngine(): void {
  const backend = useBackendAvailable();
  const tradeHydrated = useTradeStoreHydrated();
  const stakingHydrated = useStakingStoreHydrated();
  const catchup = useStakingStore((s) => s.catchupAccruals);
  const positions = useTradeStore((s) => s.positions);

  React.useEffect(() => {
    if (backend || !tradeHydrated || !stakingHydrated) return;
    catchup(positions);
    const id = setInterval(
      () => catchup(useTradeStore.getState().positions),
      60_000,
    );
    return () => clearInterval(id);
  }, [backend, tradeHydrated, stakingHydrated, catchup, positions]);
}
