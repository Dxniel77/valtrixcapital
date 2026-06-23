import { allowOfflineSimulation } from "@/lib/runtime-mode";

/**
 * Production builds use Postgres-backed APIs only — never restore or save
 * client-side demo / simulated financial state to localStorage.
 */
export function persistServerOwnedDataOnly(): boolean {
  return !allowOfflineSimulation();
}

/** Zustand persist keys that may hold offline demo financial data. */
export const DEMO_FINANCIAL_STORAGE_KEYS = [
  "valtrix.admin.v3",
  "valtrix.referrals.v2",
  "valtrix.staking.v1",
  "valtrix.wallet.v1",
  "valtrix.trade.v1",
  "valtrix.treasury.v1",
  "valtrix.bot.v4",
  "valtrix.liquidation.v1",
] as const;

let legacyDemoPurged = false;

/** Removes stale demo localStorage written during development or earlier builds. */
export function purgeDemoFinancialLocalStorage(): void {
  if (allowOfflineSimulation() || typeof window === "undefined" || legacyDemoPurged) {
    return;
  }
  legacyDemoPurged = true;
  for (const key of DEMO_FINANCIAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}
