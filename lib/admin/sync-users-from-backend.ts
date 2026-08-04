import type { WithdrawalRule } from "@/lib/admin/withdrawal-eligibility";
import {
  parseWithdrawalRuleJson,
} from "@/lib/admin/grant-rules";
import { recomputeWithdrawalUnlock } from "@/lib/admin/user-fields";
import { recountDirectReferrals, findSponsorUser } from "@/lib/admin/sponsor";
import type { AdminUser } from "@/lib/admin/store";
import { shortenAddress } from "@/lib/utils";

export interface BackendAdminUserDto {
  id: string;
  walletAddress: string;
  username: string | null;
  earningsBalance: number;
  lockedCapital: number;
  totalEarned: number;
  isActive: boolean;
  role: "USER" | "ADMIN";
  registrationSource: "referral" | "direct";
  referrerWallet: string | null;
  referrerUsername: string | null;
  directReferrals: number;
  accountGranted: boolean;
  withdrawalUnlocked: boolean;
  withdrawalAllowance?: number;
  ibStrategyId?: string | null;
  ibBoost?: {
    strategyId: string;
    name: string;
    passiveBonusBps: number;
    tradeBonusExtraBps: number;
  } | null;
  isIb?: boolean;
  ibNetDeposit?: {
    enabled: boolean;
    level1DepositBps: number;
    level2DepositBps: number;
    notes: string;
  } | null;
  withdrawalRule: WithdrawalRule | null;
  realCapital: number;
  companyCapital: number;
  directSalesVolume: number;
  levelVolumes: number[];
  createdAt: string;
}

export function mapBackendUserToAdmin(db: BackendAdminUserDto): AdminUser {
  // Volume fields may be recomputed for progress UI, but full unlock + allowance
  // always come from the server — never invent unlock from partial release.
  const mapped = recomputeWithdrawalUnlock({
    id: db.id,
    alias: db.username?.trim() || shortenAddress(db.walletAddress),
    wallet: db.walletAddress,
    role: db.role,
    status: db.isActive ? "ACTIVE" : "INACTIVE",
    network: "BSC",
    capital: db.lockedCapital,
    realCapital: db.realCapital,
    companyCapital: db.companyCapital,
    balance: db.earningsBalance,
    totalEarned: db.totalEarned,
    referrals: db.directReferrals,
    uplineWallet: db.referrerWallet,
    referrerUsername: db.referrerUsername,
    registrationSource: db.registrationSource,
    joinedAt: Date.parse(db.createdAt) || Date.now(),
    accountGranted: db.accountGranted,
    withdrawalUnlocked: db.withdrawalUnlocked,
    withdrawalAllowance: db.withdrawalAllowance ?? 0,
    ibStrategyId: db.ibStrategyId ?? null,
    ibBoost: db.ibBoost ?? null,
    isIb: db.isIb ?? false,
    ibNetDeposit: db.ibNetDeposit ?? null,
    withdrawalRule: db.withdrawalRule ?? parseWithdrawalRuleJson(null),
    directSalesVolume: db.directSalesVolume,
    levelVolumes: db.levelVolumes.length > 0 ? db.levelVolumes : [0, 0, 0, 0, 0, 0, 0, 0],
    operationalEarned: 0,
    networkEarned: 0,
    passiveEarned: 0,
  });
  return {
    ...mapped,
    withdrawalUnlocked: db.withdrawalUnlocked,
    withdrawalAllowance: db.withdrawalAllowance ?? 0,
    ibStrategyId: db.ibStrategyId ?? null,
    ibBoost: db.ibBoost ?? null,
    isIb: db.isIb ?? false,
    ibNetDeposit: db.ibNetDeposit ?? null,
  };
}

/** Merge server users into admin state — DB is source of truth when available. */
export function mergeBackendUsers(
  localUsers: AdminUser[],
  dbUsers: BackendAdminUserDto[],
): AdminUser[] {
  if (dbUsers.length === 0) return localUsers;

  const byWallet = new Map<string, AdminUser>();
  for (const db of dbUsers) {
    byWallet.set(db.walletAddress.toLowerCase(), mapBackendUserToAdmin(db));
  }

  for (const local of localUsers) {
    const key = local.wallet.toLowerCase();
    const fromDb = byWallet.get(key);
    if (!fromDb) {
      byWallet.set(key, local);
      continue;
    }

    const uplineWallet = fromDb.uplineWallet ?? local.uplineWallet;
    const localSponsor = local.uplineWallet
      ? findSponsorUser(localUsers, local.uplineWallet)
      : null;

    byWallet.set(key, {
      ...fromDb,
      alias: fromDb.alias || local.alias,
      accountGranted: fromDb.accountGranted,
      withdrawalUnlocked: fromDb.withdrawalUnlocked,
      withdrawalAllowance: fromDb.withdrawalAllowance ?? 0,
      ibStrategyId: fromDb.ibStrategyId ?? null,
      ibBoost: fromDb.ibBoost ?? null,
      isIb: fromDb.isIb ?? false,
      ibNetDeposit: fromDb.ibNetDeposit ?? null,
      withdrawalRule: fromDb.withdrawalRule,
      uplineWallet,
      referrerUsername:
        fromDb.referrerUsername ??
        local.referrerUsername ??
        localSponsor?.alias ??
        null,
      registrationSource: uplineWallet ? "referral" : fromDb.registrationSource,
      operationalEarned: local.operationalEarned,
      networkEarned: local.networkEarned,
      passiveEarned: local.passiveEarned,
      levelVolumes: fromDb.levelVolumes.some((v) => v > 0)
        ? fromDb.levelVolumes
        : local.levelVolumes.some((v) => v > 0)
          ? local.levelVolumes
          : fromDb.levelVolumes,
      directSalesVolume:
        fromDb.directSalesVolume > 0
          ? fromDb.directSalesVolume
          : local.directSalesVolume > 0
            ? local.directSalesVolume
            : fromDb.directSalesVolume,
      realCapital: fromDb.realCapital,
      companyCapital: fromDb.companyCapital,
    });
  }

  return recountDirectReferrals(
    [...byWallet.values()].sort((a, b) => b.joinedAt - a.joinedAt),
  );
}
