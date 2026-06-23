"use client";

import * as React from "react";
import type { StakingNetwork } from "@/lib/staking/store";
import { fetchTreasuryLiquidity } from "@/lib/api/client";
import { useTreasuryStore } from "@/lib/admin/treasury-store";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { allowOfflineSimulation } from "@/lib/runtime-mode";

export interface TreasuryLiquiditySnapshot {
  bscBalance: number;
  polygonBalance: number;
  totalBalance: number;
  balanceFor: (network: StakingNetwork) => number;
  hasPoolLiquidity: boolean;
  canCoverPayout: (network: StakingNetwork, netAmount: number) => boolean;
}

const emptySnapshot: TreasuryLiquiditySnapshot = {
  bscBalance: 0,
  polygonBalance: 0,
  totalBalance: 0,
  balanceFor: () => 0,
  hasPoolLiquidity: false,
  canCoverPayout: () => false,
};

function toSnapshot(
  bscBalance: number,
  polygonBalance: number,
): TreasuryLiquiditySnapshot {
  const totalBalance = bscBalance + polygonBalance;
  const balanceFor = (network: StakingNetwork) =>
    network === "POLYGON" ? polygonBalance : bscBalance;

  return {
    bscBalance,
    polygonBalance,
    totalBalance,
    balanceFor,
    hasPoolLiquidity: totalBalance > 0,
    canCoverPayout: (network, netAmount) =>
      netAmount > 0 && balanceFor(network) >= netAmount,
  };
}

/** Reads company payout-pool liquidity (admin loads minus payouts). */
export function useTreasuryLiquidity(): TreasuryLiquiditySnapshot & {
  loading: boolean;
} {
  const backend = useBackendAvailable();
  const localBsc = useTreasuryStore((s) => s.bscBalance);
  const localPolygon = useTreasuryStore((s) => s.polygonBalance);
  const [remote, setRemote] = React.useState<{
    bscBalance: number;
    polygonBalance: number;
    totalBalance: number;
  } | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!backend) {
      setRemote(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetchTreasuryLiquidity();
        if (cancelled || !res.backend) return;
        setRemote({
          bscBalance: res.bscBalance,
          polygonBalance: res.polygonBalance,
          totalBalance: res.totalBalance,
        });
      } catch {
        if (!cancelled) setRemote(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [backend]);

  return React.useMemo(() => {
    if (backend) {
      if (!remote) {
        return { ...emptySnapshot, loading };
      }
      return { ...toSnapshot(remote.bscBalance, remote.polygonBalance), loading };
    }

    if (allowOfflineSimulation()) {
      return {
        ...toSnapshot(localBsc, localPolygon),
        loading: false,
      };
    }

    return { ...emptySnapshot, loading: false };
  }, [backend, remote, loading, localBsc, localPolygon]);
}
