"use client";

import * as React from "react";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import {
  confirmDepositOnServer,
  fetchUserPortfolio,
} from "@/lib/api/client";
import { hydratePortfolioFromServer } from "@/lib/staking/hydrate-portfolio";
import type { PortfolioDto } from "@/lib/staking/portfolio-types";
import { useStakingStore } from "@/lib/staking/store";

const inflightDeposits = new Set<string>();

async function tryFinalizePendingDeposit(depositId: string): Promise<void> {
  if (inflightDeposits.has(depositId)) return;
  inflightDeposits.add(depositId);

  try {
    try {
      await confirmDepositOnServer(depositId);
    } catch {
      /* not ready yet, already confirmed, or transient error */
    }

    const portfolioRes = await fetchUserPortfolio();
    if (portfolioRes.backend && portfolioRes.portfolio) {
      hydratePortfolioFromServer(portfolioRes.portfolio as PortfolioDto);
    } else {
      useStakingStore.getState().cancelPendingDeposit();
    }
  } finally {
    inflightDeposits.delete(depositId);
  }
}

/**
 * Optional hook for in-session deposit completion (e.g. wallet claim UI).
 * Not mounted globally — `useBackendUserSync` + server portfolio finalization
 * handle pending deposits on dashboard load.
 */
export function usePendingDepositSync(): void {
  const backend = useBackendAvailable();
  const depositId = useStakingStore(
    (s) => s.pendingDeposit?.serverDepositId ?? null,
  );
  const attemptedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!backend || !depositId) {
      attemptedRef.current = null;
      return;
    }
    if (attemptedRef.current === depositId) return;

    attemptedRef.current = depositId;
    void tryFinalizePendingDeposit(depositId);
  }, [backend, depositId]);
}
