"use client";

import * as React from "react";
import { useTradeStore, useTradeStoreHydrated } from "@/lib/trade/store";
import { useStakingStore } from "@/lib/staking/store";

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
 * Wires the yield engine to the trade store. Runs on mount, every minute,
 * and whenever positions change (so a freshly resolved trade today still
 * applies retroactively if the user later refreshes after UTC midnight).
 */
export function useYieldEngine(): void {
  const tradeHydrated = useTradeStoreHydrated();
  const stakingHydrated = useStakingStoreHydrated();
  const catchup = useStakingStore((s) => s.catchupAccruals);
  const positions = useTradeStore((s) => s.positions);

  React.useEffect(() => {
    if (!tradeHydrated || !stakingHydrated) return;
    catchup(positions);
    const id = setInterval(
      () => catchup(useTradeStore.getState().positions),
      60_000,
    );
    return () => clearInterval(id);
  }, [tradeHydrated, stakingHydrated, catchup, positions]);
}
