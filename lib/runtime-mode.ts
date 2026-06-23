/**
 * Runtime mode helpers (inlined at build time via NODE_ENV).
 *
 * Production (`next build` / `next start`) uses Postgres-backed APIs only.
 * Demo seeds, simulated balances, and offline financial engines are disabled.
 */

/** True when running a production build (`next build` / `next start`). */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Local-only demo seeds and financial simulation (development / staging). */
export function allowOfflineSimulation(): boolean {
  return !isProductionRuntime();
}

/** Synthetic `0xbsc…` / `0xpol…` chain hashes when explorer pools are empty. */
export function allowSyntheticChainTx(): boolean {
  return !isProductionRuntime();
}
