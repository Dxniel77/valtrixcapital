import { REFERRAL_LEVELS } from "./constants";

export interface DownlineLevelRow<T> {
  level: number;
  items: T[];
}

/**
 * Breadth-first downline levels from a root sponsor.
 * Each member appears at most once (shortest path). Cycles are skipped.
 */
export function computeDownlineLevels<T>(
  rootKey: string,
  getDirectReferrals: (sponsorKey: string) => T[],
  getKey: (item: T) => string,
  maxLevel = REFERRAL_LEVELS,
): DownlineLevelRow<T>[] {
  const normalize = (key: string) => key.toLowerCase();
  const visited = new Set<string>([normalize(rootKey)]);
  let frontier = [normalize(rootKey)];
  const rows: DownlineLevelRow<T>[] = [];

  for (let level = 1; level <= maxLevel; level += 1) {
    const items: T[] = [];
    if (frontier.length > 0) {
      for (const sponsorKey of frontier) {
        for (const candidate of getDirectReferrals(sponsorKey)) {
          const key = normalize(getKey(candidate));
          if (visited.has(key)) continue;
          visited.add(key);
          items.push(candidate);
        }
      }
      frontier = items.map((item) => normalize(getKey(item)));
    }

    rows.push({ level, items });
  }

  return rows;
}

/** Count all descendants below a member within a flat downline list. */
export function countNetworkReferrals(
  memberId: string,
  downlineIds: Iterable<{ id: string; referrerId: string }>,
): number {
  const childrenByParent = new Map<string, string[]>();
  for (const row of downlineIds) {
    const list = childrenByParent.get(row.referrerId) ?? [];
    list.push(row.id);
    childrenByParent.set(row.referrerId, list);
  }

  let total = 0;
  const queue = [...(childrenByParent.get(memberId) ?? [])];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    total += 1;
    queue.push(...(childrenByParent.get(id) ?? []));
  }

  return total;
}
