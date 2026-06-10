import type { AdminMovement, AdminUser } from "@/lib/admin/store";
import {
  computeNetworkLevels,
  countNetworkSize,
} from "@/lib/admin/network-tree";

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
    totalDeposits: number;
    totalWithdrawals: number;
    pendingWithdrawals: number;
    pendingCount: number;
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

export function findAdminUserById(
  users: AdminUser[],
  id: string,
): AdminUser | null {
  return users.find((u) => u.id === id) ?? null;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** Period total billed — always operativa + red + pasiva (L1–L8 is volume only). */
export function billingPeriodTotal(
  row: Pick<UserLeaderRow, "operational" | "network" | "passive">,
): number {
  return round(row.operational + row.network + row.passive);
}

function yieldKindFor(m: AdminMovement): "operational" | "passive" | null {
  if (m.type !== "YIELD") return null;
  if (m.yieldKind) return m.yieldKind;
  return m.amount < 50 ? "operational" : "passive";
}

export function computeUserBilling(
  user: AdminUser,
  allUsers: AdminUser[],
  movements: AdminMovement[],
  period: LeaderPeriod,
): UserLeaderRow {
  const since = Date.now() - PERIOD_MS[period];
  const wallet = user.wallet.toLowerCase();
  const periodMovements = movements.filter((m) => m.timestamp >= since);

  const userPeriod = periodMovements.filter(
    (m) => m.wallet.toLowerCase() === wallet,
  );

  const operational = userPeriod
    .filter((m) => yieldKindFor(m) === "operational")
    .reduce((a, m) => a + m.amount, 0);

  const passive = userPeriod
    .filter((m) => yieldKindFor(m) === "passive")
    .reduce((a, m) => a + m.amount, 0);

  const network = userPeriod
    .filter((m) => m.type === "COMMISSION")
    .reduce((a, m) => a + m.amount, 0);

  const networkLevels = computeNetworkLevels(user.wallet, allUsers);
  const byLevel: LevelRevenue[] = networkLevels.map(({ level, members }) => {
    const memberWallets = new Set(
      members.map((m) => m.wallet.toLowerCase()),
    );
    const amount = periodMovements
      .filter(
        (m) =>
          m.type === "DEPOSIT" && memberWallets.has(m.wallet.toLowerCase()),
      )
      .reduce((a, m) => a + m.amount, 0);
    return { level, amount: round(amount) };
  });

  const operationalR = round(operational);
  const networkR = round(network);
  const passiveR = round(passive);
  const total = billingPeriodTotal({
    operational: operationalR,
    network: networkR,
    passive: passiveR,
  });

  return {
    user,
    total,
    byLevel,
    operational: operationalR,
    network: networkR,
    passive: passiveR,
  };
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

  const levelRows = computeNetworkLevels(user.wallet, allUsers);
  const networkByLevel = levelRows.map(({ level, count, volume }) => ({
    level,
    count,
    volume,
  }));

  const userMovements = movements
    .filter((m) => m.wallet.toLowerCase() === wallet)
    .sort((a, b) => b.timestamp - a.timestamp);

  const deposits = userMovements.filter((m) => m.type === "DEPOSIT");
  const withdrawals = userMovements.filter((m) => m.type === "WITHDRAWAL");
  const pending = withdrawals.filter(
    (m) => m.status === "PROCESSING" || m.status === "REVIEW",
  );

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
      networkSize: countNetworkSize(levelRows),
      totalDeposits: round(deposits.reduce((a, m) => a + m.amount, 0)),
      totalWithdrawals: round(
        withdrawals
          .filter((m) => m.status === "COMPLETED")
          .reduce((a, m) => a + m.amount, 0),
      ),
      pendingWithdrawals: round(pending.reduce((a, m) => a + m.amount, 0)),
      pendingCount: pending.length,
    },
  };
}

export function computeTopPerformers(
  users: AdminUser[],
  movements: AdminMovement[],
  period: LeaderPeriod,
): UserLeaderRow[] {
  const rows: UserLeaderRow[] = [];

  for (const user of users) {
    if (user.status !== "ACTIVE") continue;
    const row = computeUserBilling(user, users, movements, period);
    if (row.total <= 0 && user.totalEarned <= 0) continue;
    rows.push(row);
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
    daily: round(daily),
    weekly: round(weekly),
    monthly: round(monthly),
    threeMonths: round(threeMonths),
    operational,
    network,
    passive,
    displayTotal: round(displayTotal),
  };
}
