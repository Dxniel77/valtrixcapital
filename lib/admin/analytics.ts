import type { AdminMovement, AdminUser } from "@/lib/admin/store";

export type LeaderPeriod = "week" | "month" | "3months";

const PERIOD_MS: Record<LeaderPeriod, number> = {
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
  "3months": 90 * 86_400_000,
};

export interface LevelRevenue {
  level: number;
  amount: number;
}

export interface UserLeaderRow {
  user: AdminUser;
  total: number;
  byLevel: LevelRevenue[];
  operational: number;
  network: number;
  passive: number;
}

export interface UserDetailSnapshot {
  user: AdminUser;
  movements: AdminMovement[];
  directReferrals: AdminUser[];
  networkByLevel: { level: number; count: number; volume: number }[];
  totals: {
    capital: number;
    balance: number;
    totalEarned: number;
    operational: number;
    network: number;
    passive: number;
    directReferrals: number;
    networkSize: number;
  };
}

export function findAdminUser(
  users: AdminUser[],
  query: string,
): AdminUser | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return (
    users.find(
      (u) =>
        u.alias.toLowerCase() === q ||
        u.wallet.toLowerCase() === q ||
        u.alias.toLowerCase().includes(q) ||
        u.wallet.toLowerCase().includes(q),
    ) ?? null
  );
}

export function buildUserDetail(
  user: AdminUser,
  allUsers: AdminUser[],
  movements: AdminMovement[],
): UserDetailSnapshot {
  const wallet = user.wallet.toLowerCase();
  const directReferrals = allUsers.filter(
    (u) => u.uplineWallet?.toLowerCase() === wallet,
  );

  const networkByLevel = Array.from({ length: 8 }, (_, i) => {
    const level = i + 1;
    const count = level === 1 ? directReferrals.length : 0;
    const volume = user.levelVolumes[i] ?? 0;
    return { level, count: level === 1 ? count : Math.max(0, Math.floor(user.referrals / level)), volume };
  });

  const userMovements = movements
    .filter((m) => m.wallet.toLowerCase() === wallet)
    .sort((a, b) => b.timestamp - a.timestamp);

  return {
    user,
    movements: userMovements,
    directReferrals,
    networkByLevel,
    totals: {
      capital: user.capital,
      balance: user.balance,
      totalEarned: user.totalEarned,
      operational: user.operationalEarned,
      network: user.networkEarned,
      passive: user.passiveEarned,
      directReferrals: directReferrals.length,
      networkSize: user.referrals,
    },
  };
}

export function computeTopPerformers(
  users: AdminUser[],
  movements: AdminMovement[],
  period: LeaderPeriod,
): UserLeaderRow[] {
  const since = Date.now() - PERIOD_MS[period];
  const rows: UserLeaderRow[] = [];

  for (const user of users) {
    if (user.status !== "ACTIVE") continue;
    const wallet = user.wallet.toLowerCase();
    const periodMovements = movements.filter(
      (m) => m.wallet.toLowerCase() === wallet && m.timestamp >= since,
    );

    const operational = periodMovements
      .filter((m) => m.type === "YIELD")
      .reduce((a, m) => a + m.amount, 0);
    const network = periodMovements
      .filter((m) => m.type === "COMMISSION")
      .reduce((a, m) => a + m.amount, 0);
    const passive = user.passiveEarned * (period === "week" ? 0.08 : period === "month" ? 0.25 : 0.6);

    const byLevel: LevelRevenue[] = user.levelVolumes.map((amount, i) => ({
      level: i + 1,
      amount: amount * (period === "week" ? 0.1 : period === "month" ? 0.3 : 0.7),
    }));

    const total =
      operational +
      network +
      passive +
      byLevel.reduce((a, l) => a + l.amount, 0);

    if (total <= 0 && user.totalEarned <= 0) continue;

    rows.push({
      user,
      total: Math.round(total * 100) / 100,
      byLevel,
      operational: Math.round(operational * 100) / 100,
      network: Math.round(network * 100) / 100,
      passive: Math.round(passive * 100) / 100,
    });
  }

  return rows.sort((a, b) => b.total - a.total);
}

export interface EarningsBreakdown {
  hasNetwork: boolean;
  daily: number;
  weekly: number;
  monthly: number;
  threeMonths: number;
  operational: number;
  network: number;
  passive: number;
  displayTotal: number;
}

/** Marketing poster totals: network users sum all streams; others daily passive + operational. */
export function computeShareEarnings(user: AdminUser): EarningsBreakdown {
  const hasNetwork = user.referrals > 0 || user.networkEarned > 0;
  const operational = user.operationalEarned;
  const network = user.networkEarned;
  const passive = user.passiveEarned;

  const daily = hasNetwork
    ? passive / 30 + operational / 7 + network / 30
    : passive / 30 + operational / 7;
  const weekly = daily * 7;
  const monthly = daily * 30;
  const threeMonths = daily * 90;
  const displayTotal = hasNetwork
    ? network + passive + operational
    : passive + operational;

  return {
    hasNetwork,
    daily: Math.round(daily * 100) / 100,
    weekly: Math.round(weekly * 100) / 100,
    monthly: Math.round(monthly * 100) / 100,
    threeMonths: Math.round(threeMonths * 100) / 100,
    operational,
    network,
    passive,
    displayTotal: Math.round(displayTotal * 100) / 100,
  };
}
