import type { AdminUser } from "@/lib/admin/store";
import { computeDownlineLevels } from "@/lib/referrals/downline-tree";

export interface NetworkLevelRow {
  level: number;
  count: number;
  volume: number;
  members: AdminUser[];
}

export function buildUplineIndex(users: AdminUser[]): Map<string, AdminUser[]> {
  const map = new Map<string, AdminUser[]>();
  for (const u of users) {
    const up = u.uplineWallet?.toLowerCase();
    if (!up) continue;
    const list = map.get(up) ?? [];
    list.push(u);
    map.set(up, list);
  }
  return map;
}

/** BFS downline levels L1–L8 from a sponsor wallet. Each user appears once. */
export function computeNetworkLevels(
  sponsorWallet: string,
  users: AdminUser[],
  maxLevel = 8,
): NetworkLevelRow[] {
  const byUpline = buildUplineIndex(users);
  const levelRows = computeDownlineLevels(
    sponsorWallet,
    (wallet) => byUpline.get(wallet.toLowerCase()) ?? [],
    (user) => user.wallet,
    maxLevel,
  );

  return levelRows.map(({ level, items }) => ({
    level,
    count: items.length,
    volume: items.reduce((acc, m) => acc + m.capital, 0),
    members: items,
  }));
}

export function countNetworkSize(levels: NetworkLevelRow[]): number {
  return levels.reduce((acc, l) => acc + l.count, 0);
}
