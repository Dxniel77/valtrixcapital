import {
  DEFAULT_WITHDRAWAL_RULE,
  shouldUnlockWithdrawals,
  type WithdrawalRule,
} from "@/lib/admin/withdrawal-eligibility";

export interface AdminUserShape {
  id: string;
  alias: string;
  wallet: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "INACTIVE";
  network: "BSC" | "POLYGON";
  capital: number;
  balance: number;
  totalEarned: number;
  referrals: number;
  uplineWallet: string | null;
  joinedAt: number;
  accountGranted: boolean;
  withdrawalUnlocked: boolean;
  withdrawalRule: WithdrawalRule;
  directSalesVolume: number;
  levelVolumes: number[];
  operationalEarned: number;
  networkEarned: number;
  passiveEarned: number;
}

export function enrichDemoUser(
  user: AdminUserShape,
  index: number,
): AdminUserShape {
  const granted = index % 3 !== 0;
  const directSales = granted
    ? Math.round((50 + Math.random() * 800) * 10) / 10
    : 0;
  const levelVolumes = Array.from({ length: 8 }, (_, lv) =>
    Math.round((10 + Math.random() * (400 - lv * 30)) * 10) / 10,
  );
  const operational = user.totalEarned * (0.2 + Math.random() * 0.3);
  const network = user.totalEarned * (0.15 + Math.random() * 0.25);
  const passive = Math.max(0, user.totalEarned - operational - network);

  const base: AdminUserShape = {
    ...user,
    accountGranted: granted,
    withdrawalRule: { ...DEFAULT_WITHDRAWAL_RULE },
    directSalesVolume: directSales,
    levelVolumes,
    operationalEarned: Math.round(operational * 100) / 100,
    networkEarned: Math.round(network * 100) / 100,
    passiveEarned: Math.round(passive * 100) / 100,
  };

  return {
    ...base,
    withdrawalUnlocked: granted ? shouldUnlockWithdrawals(base) : false,
  };
}

export function recomputeWithdrawalUnlock(user: AdminUserShape): AdminUserShape {
  if (!user.accountGranted) return user;
  return {
    ...user,
    withdrawalUnlocked: shouldUnlockWithdrawals(user),
  };
}
