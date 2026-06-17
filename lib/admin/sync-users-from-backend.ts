import {
  DEFAULT_WITHDRAWAL_RULE,
} from "@/lib/admin/withdrawal-eligibility";
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
  createdAt: string;
}

export function mapBackendUserToAdmin(db: BackendAdminUserDto): AdminUser {
  return recomputeWithdrawalUnlock({
    id: db.id,
    alias: db.username?.trim() || shortenAddress(db.walletAddress),
    wallet: db.walletAddress,
    role: db.role,
    status: db.isActive ? "ACTIVE" : "INACTIVE",
    network: "BSC",
    capital: db.lockedCapital,
    balance: db.earningsBalance,
    totalEarned: db.totalEarned,
    referrals: db.directReferrals,
    uplineWallet: db.referrerWallet,
    referrerUsername: db.referrerUsername,
    registrationSource: db.registrationSource,
    joinedAt: Date.parse(db.createdAt) || Date.now(),
    accountGranted: false,
    withdrawalUnlocked: false,
    withdrawalRule: { ...DEFAULT_WITHDRAWAL_RULE },
    directSalesVolume: 0,
    levelVolumes: [0, 0, 0, 0, 0, 0, 0, 0],
    operationalEarned: 0,
    networkEarned: 0,
    passiveEarned: 0,
  });
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
      accountGranted: local.accountGranted || fromDb.accountGranted,
      withdrawalRule: local.accountGranted
        ? local.withdrawalRule
        : fromDb.withdrawalRule,
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
      levelVolumes: local.levelVolumes.some((v) => v > 0)
        ? local.levelVolumes
        : fromDb.levelVolumes,
      directSalesVolume:
        local.directSalesVolume > 0
          ? local.directSalesVolume
          : fromDb.directSalesVolume,
    });
  }

  return recountDirectReferrals(
    [...byWallet.values()].sort((a, b) => b.joinedAt - a.joinedAt),
  );
}
