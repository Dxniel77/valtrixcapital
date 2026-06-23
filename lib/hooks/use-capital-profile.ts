"use client";

import { useShallow } from "zustand/react/shallow";
import { useStakingStore } from "@/lib/staking/store";
import { hasRealDepositedCapital } from "@/lib/staking/capital-profile";

export function useCapitalProfile() {
  return useStakingStore(
    useShallow((s) => ({
      realCapital: s.realCapital,
      companyCapital: s.companyCapital,
      accountGranted: s.accountGranted,
      capitalProfileSynced: s.capitalProfileSynced,
    })),
  );
}

export function useHasRealDepositedCapital(): boolean {
  const realCapital = useStakingStore((s) => s.realCapital);
  const capitalProfileSynced = useStakingStore((s) => s.capitalProfileSynced);
  const accountGranted = useStakingStore((s) => s.accountGranted);
  return hasRealDepositedCapital({ realCapital, capitalProfileSynced, accountGranted });
}
