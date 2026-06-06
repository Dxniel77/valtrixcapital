"use client";

import { useYieldEngine } from "@/lib/staking/store";
import {
  useCommissionEngine,
  useNetworkPayoutEngine,
} from "@/lib/referrals/store";
import { useOperationalCreditEngine } from "@/lib/staking/operational";
import { useWithdrawalEngine } from "@/lib/wallet/store";

/** Runs all client-side earnings schedulers for the dashboard. */
export function EarningsEngines() {
  useYieldEngine();
  useCommissionEngine();
  useNetworkPayoutEngine();
  useOperationalCreditEngine();
  useWithdrawalEngine();
  return null;
}
