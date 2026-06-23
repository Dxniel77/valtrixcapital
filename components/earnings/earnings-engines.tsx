"use client";

import { allowOfflineSimulation } from "@/lib/runtime-mode";
import { useYieldEngine } from "@/lib/staking/store";
import {
  useCommissionEngine,
  useNetworkPayoutEngine,
} from "@/lib/referrals/store";
import { useOperationalCreditEngine } from "@/lib/staking/operational";
import { useWithdrawalEngine } from "@/lib/wallet/store";

function OfflineEarningsEngines() {
  useYieldEngine();
  useCommissionEngine();
  useNetworkPayoutEngine();
  useOperationalCreditEngine();
  useWithdrawalEngine();
  return null;
}

/** Runs client-side earnings schedulers (development / offline demo only). */
export function EarningsEngines() {
  if (!allowOfflineSimulation()) return null;
  return <OfflineEarningsEngines />;
}
