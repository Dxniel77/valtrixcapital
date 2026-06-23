"use client";

import { useStakingStore } from "@/lib/staking/store";
import { hasRealDepositedCapital } from "@/lib/staking/capital-profile";

export function useCapitalProfile() {
  return useStakingStore((s) => ({
    realCapital: s.realCapital,
    companyCapital: s.companyCapital,
    accountGranted: s.accountGranted,
    capitalProfileSynced: s.capitalProfileSynced,
  }));
}

export function useHasRealDepositedCapital(): boolean {
  const { realCapital, capitalProfileSynced, accountGranted } = useCapitalProfile();
  return hasRealDepositedCapital({ realCapital, capitalProfileSynced, accountGranted });
}
