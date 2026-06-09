import type { AdminUser } from "@/lib/admin/store";

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

/** BFS downline levels L1–L8 from a sponsor wallet. */
export function computeNetworkLevels(
  sponsorWallet: string,
  users: AdminUser[],
  maxLevel = 8,
): NetworkLevelRow[] {
  const byUpline = buildUplineIndex(users);
  const root = sponsorWallet.toLowerCase();
  const rows: NetworkLevelRow[] = [];
  let frontier: string[] = [root];

  for (let level = 1; level <= maxLevel; level += 1) {
    const members = frontier.flatMap((w) => byUpline.get(w) ?? []);
    rows.push({
      level,
      count: members.length,
      volume: members.reduce((acc, m) => acc + m.capital, 0),
      members,
    });
    frontier = members.map((m) => m.wallet.toLowerCase());
    if (frontier.length === 0) {
      for (let pad = level + 1; pad <= maxLevel; pad += 1) {
        rows.push({ level: pad, count: 0, volume: 0, members: [] });
      }
      break;
    }
  }

  while (rows.length < maxLevel) {
    rows.push({
      level: rows.length + 1,
      count: 0,
      volume: 0,
      members: [],
    });
  }

  return rows.slice(0, maxLevel);
}

export function countNetworkSize(levels: NetworkLevelRow[]): number {
  return levels.reduce((acc, l) => acc + l.count, 0);
}
