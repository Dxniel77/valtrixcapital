import type { AdminUser } from "@/lib/admin/store";

export type SponsorUpdateError =
  | "NOT_FOUND"
  | "INVALID_WALLET"
  | "SELF_SPONSOR"
  | "SPONSOR_NOT_FOUND"
  | "CYCLE";

export function referralCodeFromWallet(wallet: string): string {
  const clean = wallet.replace(/^0x/i, "").toUpperCase();
  return `VX${clean.slice(-6)}`;
}

export function findUserByReferralCode(
  users: AdminUser[],
  code: string,
): AdminUser | null {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  return (
    users.find((u) => referralCodeFromWallet(u.wallet) === normalized) ?? null
  );
}

export function resolveSponsorQuery(
  users: AdminUser[],
  query: string,
): AdminUser | null {
  const q = query.trim();
  if (!q) return null;

  if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
    return (
      users.find((u) => u.wallet.toLowerCase() === q.toLowerCase()) ?? null
    );
  }

  const byCode = findUserByReferralCode(users, q);
  if (byCode) return byCode;

  const lower = q.toLowerCase();
  return (
    users.find(
      (u) =>
        u.alias.toLowerCase() === lower ||
        u.alias.toLowerCase().includes(lower),
    ) ?? null
  );
}

export function wouldCreateUplineCycle(
  userWallet: string,
  newUplineWallet: string | null,
  users: AdminUser[],
): boolean {
  if (!newUplineWallet) return false;

  const userKey = userWallet.toLowerCase();
  const newUpKey = newUplineWallet.toLowerCase();
  if (userKey === newUpKey) return true;

  const byWallet = new Map(
    users.map((u) => [u.wallet.toLowerCase(), u] as const),
  );
  let current: string | null = newUpKey;
  const seen = new Set<string>();

  while (current) {
    if (current === userKey) return true;
    if (seen.has(current)) break;
    seen.add(current);
    current = byWallet.get(current)?.uplineWallet?.toLowerCase() ?? null;
  }

  return false;
}

export function recountDirectReferrals(users: AdminUser[]): AdminUser[] {
  const counts = new Map<string, number>();
  for (const u of users) {
    const up = u.uplineWallet?.toLowerCase();
    if (!up) continue;
    counts.set(up, (counts.get(up) ?? 0) + 1);
  }
  return users.map((u) => ({
    ...u,
    referrals: counts.get(u.wallet.toLowerCase()) ?? 0,
  }));
}

export function findSponsorUser(
  users: AdminUser[],
  uplineWallet: string | null,
): AdminUser | null {
  if (!uplineWallet) return null;
  return (
    users.find((u) => u.wallet.toLowerCase() === uplineWallet.toLowerCase()) ??
    null
  );
}
