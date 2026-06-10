/** Normalize an EVM address for comparisons (lowercase). */
export function normalizeWallet(address: string): string {
  return address.trim().toLowerCase();
}

const WALLET_RE = /^0x[a-f0-9]{40}$/;

/**
 * Manager wallets from `ADMIN_WALLETS` (comma-separated).
 * Add more addresses anytime without code changes.
 */
export function getAdminWallets(): string[] {
  const raw = process.env.ADMIN_WALLETS ?? "";
  const wallets = raw
    .split(",")
    .map((entry) => normalizeWallet(entry))
    .filter((entry) => WALLET_RE.test(entry));
  return [...new Set(wallets)];
}

export function isAdminWallet(address: string | undefined | null): boolean {
  if (!address) return false;
  const normalized = normalizeWallet(address);
  if (!WALLET_RE.test(normalized)) return false;
  return getAdminWallets().includes(normalized);
}
