import type { Prisma, User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAdminWallet, normalizeWallet } from "@/lib/auth/admins";
import { fromMicro } from "@/lib/utils";
import {
  generateUniqueReferralCode,
  resolveReferrerIdByCode,
  resolveReferrerIdForLinking,
} from "@/lib/services/referral-code";
import type { WithdrawalRule } from "@/lib/admin/withdrawal-eligibility";
import {
  parseWithdrawalRuleJson,
  withdrawalRuleToJson,
} from "@/lib/admin/grant-rules";
import {
  resolveUnlockVolumes,
  unlockVolumesFromUser,
} from "@/lib/services/unlock-volume";
import { getCapitalBreakdownMap } from "@/lib/services/sponsored-capital";
import { syncUserReferralChain } from "@/lib/services/referral-chain";

export type BalanceAdjustmentTarget = "WITHDRAWABLE" | "STAKING";

export interface UserDto {
  id: string;
  walletAddress: string;
  username: string | null;
  role: UserRole;
  isActive: boolean;
  referralCode: string;
  referrerId: string | null;
  registrationSource: "referral" | "direct";
  referrerWallet: string | null;
  referrerUsername: string | null;
  directReferrals: number;
  earningsBalance: number;
  lockedCapital: number;
  totalEarned: number;
  payoutCap: number;
  accountGranted: boolean;
  withdrawalUnlocked: boolean;
  /** Partial USDT released by admin while still volume-locked. */
  withdrawalAllowance: number;
  /** Assigned IB acceleration strategy (null = platform default rates). */
  ibStrategyId: string | null;
  withdrawalRule: WithdrawalRule | null;
  realCapital: number;
  companyCapital: number;
  directSalesVolume: number;
  levelVolumes: number[];
  createdAt: string;
  updatedAt: string;
}

export function serializeUser(
  user: User,
  meta?: {
    referrerWallet?: string | null;
    referrerUsername?: string | null;
    directReferrals?: number;
    realCapital?: number;
    companyCapital?: number;
    directSalesVolume?: number;
    levelVolumes?: number[];
  },
): UserDto {
  const volumes =
    meta?.directSalesVolume !== undefined && meta?.levelVolumes
      ? {
          directSalesVolume: meta.directSalesVolume,
          levelVolumes: meta.levelVolumes,
        }
      : unlockVolumesFromUser({
          unlockDirectVolume: user.unlockDirectVolume,
          unlockLevel1Volume: user.unlockLevel1Volume,
          unlockLevel2Volume: user.unlockLevel2Volume,
        });
  return {
    id: user.id,
    walletAddress: user.walletAddress,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    referralCode: user.referralCode,
    referrerId: user.referrerId,
    registrationSource: user.referrerId ? "referral" : "direct",
    referrerWallet: meta?.referrerWallet ?? null,
    referrerUsername: meta?.referrerUsername ?? null,
    directReferrals: meta?.directReferrals ?? 0,
    earningsBalance: fromMicro(user.earningsBalance),
    lockedCapital: fromMicro(user.lockedCapital),
    totalEarned: fromMicro(user.totalEarned),
    payoutCap: fromMicro(user.payoutCap),
    accountGranted: user.accountGranted,
    withdrawalUnlocked: user.withdrawalUnlocked,
    withdrawalAllowance: fromMicro(user.withdrawalAllowance),
    ibStrategyId: user.ibStrategyId ?? null,
    withdrawalRule: user.accountGranted
      ? parseWithdrawalRuleJson(user.withdrawalRule)
      : null,
    realCapital: meta?.realCapital ?? 0,
    companyCapital: meta?.companyCapital ?? 0,
    directSalesVolume: volumes.directSalesVolume,
    levelVolumes: volumes.levelVolumes,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function findUserByWallet(
  walletAddress: string,
): Promise<User | null> {
  return prisma.user.findUnique({
    where: { walletAddress: normalizeWallet(walletAddress) },
  });
}

export async function findUserByWalletWithReferrer(walletAddress: string) {
  return prisma.user.findUnique({
    where: { walletAddress: normalizeWallet(walletAddress) },
    include: {
      referrer: { select: { walletAddress: true, username: true } },
    },
  });
}

export async function serializeUserWithReferrerAsync(
  user: User & {
    referrer?: { walletAddress: string; username: string | null } | null;
    _count?: { downline: number };
  },
): Promise<UserDto> {
  const breakdown = await getCapitalBreakdownMap([user.id]);
  const cap = breakdown.get(user.id) ?? { real: 0n, company: 0n };
  const volumes = user.accountGranted
    ? await resolveUnlockVolumes(user.id)
    : unlockVolumesFromUser({
        unlockDirectVolume: user.unlockDirectVolume,
        unlockLevel1Volume: user.unlockLevel1Volume,
        unlockLevel2Volume: user.unlockLevel2Volume,
      });
  return serializeUser(user, {
    referrerWallet: user.referrer?.walletAddress ?? null,
    referrerUsername: user.referrer?.username ?? null,
    directReferrals: user._count?.downline,
    realCapital: fromMicro(cap.real),
    companyCapital: fromMicro(cap.company),
    directSalesVolume: volumes.directSalesVolume,
    levelVolumes: volumes.levelVolumes,
  });
}

export function serializeUserWithReferrer(
  user: User & {
    referrer?: { walletAddress: string; username: string | null } | null;
  },
): UserDto {
  return serializeUser(user, {
    referrerWallet: user.referrer?.walletAddress ?? null,
    referrerUsername: user.referrer?.username ?? null,
  });
}

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function upsertUserByWallet(
  walletAddress: string,
  input?: { username?: string; referrerCode?: string | null },
): Promise<User> {
  const wallet = normalizeWallet(walletAddress);
  const existing = await prisma.user.findUnique({ where: { walletAddress: wallet } });
  if (existing) {
    let updated = existing;
    if (input?.referrerCode && !existing.referrerId) {
      const referrerId = await resolveReferrerIdForLinking(input.referrerCode);
      if (
        referrerId &&
        referrerId !== existing.id &&
        !(await wouldCreateReferrerCycle(existing.id, referrerId))
      ) {
        updated = await prisma.user.update({
          where: { id: existing.id },
          data: { referrerId },
        });
        await syncUserReferralChain(updated.id);
      }
    }
    if (input?.username && !updated.username) {
      return prisma.user.update({
        where: { id: updated.id },
        data: { username: input.username },
      });
    }
    return updated;
  }

  let referrerId: string | null = null;
  if (input?.referrerCode) {
    const candidate = await resolveReferrerIdForLinking(input.referrerCode);
    referrerId = candidate;
  }

  const referralCode = await generateUniqueReferralCode();
  const role: UserRole = isAdminWallet(wallet) ? "ADMIN" : "USER";

  return prisma.user.create({
    data: {
      walletAddress: wallet,
      username: input?.username ?? null,
      referralCode,
      referrerId,
      role,
    },
  }).then(async (user) => {
    if (referrerId) await syncUserReferralChain(user.id);
    return user;
  });
}

export class UsernameLockedError extends Error {
  readonly code = "USERNAME_LOCKED" as const;
}

export class UsernameTakenError extends Error {
  readonly code = "TAKEN" as const;
}

/** Sets username once at registration; rejects if the user already has one. */
export async function setInitialUsername(
  userId: string,
  username: string,
): Promise<User> {
  const trimmed = username.trim();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("NOT_FOUND");
  if (user.username?.trim()) throw new UsernameLockedError();

  const owner = await prisma.user.findFirst({
    where: {
      username: { equals: trimmed, mode: "insensitive" },
      NOT: { id: userId },
    },
    select: { id: true },
  });
  if (owner) throw new UsernameTakenError();

  return prisma.user.update({
    where: { id: userId },
    data: { username: trimmed },
  });
}

/** Assigns a sponsor when the user registered without one (e.g. missed at sign-in). */
export async function applyReferrerIfMissing(
  userId: string,
  referrerCode: string | null | undefined,
): Promise<User | null> {
  if (!referrerCode?.trim()) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.referrerId) return null;

  const referrerId = await resolveReferrerIdForLinking(referrerCode);
  if (!referrerId || referrerId === userId) return null;
  if (await wouldCreateReferrerCycle(userId, referrerId)) return null;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { referrerId },
  });
  await syncUserReferralChain(updated.id);
  return updated;
}

export async function listUsersForAdmin(): Promise<UserDto[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      referrer: { select: { walletAddress: true, username: true } },
      _count: { select: { downline: true } },
    },
  });
  const capitalMap = await getCapitalBreakdownMap(users.map((u) => u.id));
  const grantedIds = users.filter((u) => u.accountGranted).map((u) => u.id);
  const volumeMap = new Map<
    string,
    Awaited<ReturnType<typeof resolveUnlockVolumes>>
  >();
  await Promise.all(
    grantedIds.map(async (id) => {
      volumeMap.set(id, await resolveUnlockVolumes(id));
    }),
  );

  return users.map((user) => {
    const breakdown = capitalMap.get(user.id) ?? { real: 0n, company: 0n };
    const volumes = volumeMap.get(user.id);
    return serializeUser(user, {
      referrerWallet: user.referrer?.walletAddress ?? null,
      referrerUsername: user.referrer?.username ?? null,
      directReferrals: user._count.downline,
      realCapital: fromMicro(breakdown.real),
      companyCapital: fromMicro(breakdown.company),
      ...(volumes
        ? {
            directSalesVolume: volumes.directSalesVolume,
            levelVolumes: volumes.levelVolumes,
          }
        : {}),
    });
  });
}

export interface BalanceAdjustmentDto {
  id: string;
  amount: number;
  note: string;
  target: BalanceAdjustmentTarget;
  createdAt: string;
}

export type ReferrerUpdateErrorCode =
  | "NOT_FOUND"
  | "SPONSOR_NOT_FOUND"
  | "SELF_SPONSOR"
  | "CYCLE";

export class ReferrerUpdateException extends Error {
  constructor(readonly code: ReferrerUpdateErrorCode) {
    super(code);
    this.name = "ReferrerUpdateException";
  }
}

export type ProvisionUserErrorCode =
  | "INVALID_WALLET"
  | "SPONSOR_NOT_FOUND"
  | "USERNAME_TAKEN";

export class ProvisionUserException extends Error {
  constructor(readonly code: ProvisionUserErrorCode) {
    super(code);
    this.name = "ProvisionUserException";
  }
}

async function wouldCreateReferrerCycle(
  userId: string,
  newReferrerId: string,
): Promise<boolean> {
  let current: string | null = newReferrerId;
  const seen = new Set<string>();

  while (current) {
    if (current === userId) return true;
    if (seen.has(current)) break;
    seen.add(current);
    const ancestor: { referrerId: string | null } | null =
      await prisma.user.findUnique({
        where: { id: current },
        select: { referrerId: true },
      });
    current = ancestor?.referrerId ?? null;
  }

  return false;
}

/** Resolves sponsor by wallet, referral code, or username (case-insensitive). */
export async function resolveReferrerIdByQuery(
  query: string,
): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;

  if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
    const user = await findUserByWallet(q);
    return user?.id ?? null;
  }

  const byCode = await resolveReferrerIdByCode(q);
  if (byCode) return byCode;

  const byUsername = await prisma.user.findFirst({
    where: { username: { equals: q, mode: "insensitive" } },
    select: { id: true },
  });
  return byUsername?.id ?? null;
}

export async function adminSetUserReferrer(
  userId: string,
  referrerQuery: string | null,
): Promise<UserDto> {
  const user = await findUserById(userId);
  if (!user) throw new ReferrerUpdateException("NOT_FOUND");

  let referrerId: string | null = null;
  if (referrerQuery?.trim()) {
    referrerId = await resolveReferrerIdByQuery(referrerQuery);
    if (!referrerId) throw new ReferrerUpdateException("SPONSOR_NOT_FOUND");
    if (referrerId === userId) throw new ReferrerUpdateException("SELF_SPONSOR");
    if (await wouldCreateReferrerCycle(userId, referrerId)) {
      throw new ReferrerUpdateException("CYCLE");
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { referrerId },
    include: {
      referrer: { select: { walletAddress: true, username: true } },
      _count: { select: { downline: true } },
    },
  });

  await syncUserReferralChain(updated.id);

  return serializeUser(updated, {
    referrerWallet: updated.referrer?.walletAddress ?? null,
    referrerUsername: updated.referrer?.username ?? null,
    directReferrals: updated._count.downline,
  });
}

export async function adminProvisionUser(input: {
  walletAddress: string;
  username?: string | null;
  referrerWallet?: string | null;
  withdrawalRule?: WithdrawalRule;
}): Promise<UserDto> {
  const wallet = normalizeWallet(input.walletAddress);
  if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
    throw new ProvisionUserException("INVALID_WALLET");
  }

  const username = input.username?.trim() || null;
  if (username) {
    const usernameOwner = await prisma.user.findFirst({
      where: {
        username: { equals: username, mode: "insensitive" },
        NOT: { walletAddress: wallet },
      },
      select: { id: true },
    });
    if (usernameOwner) throw new ProvisionUserException("USERNAME_TAKEN");
  }

  let sponsorId: string | null = null;
  if (input.referrerWallet?.trim()) {
    const sponsor = await findUserByWallet(input.referrerWallet);
    if (!sponsor) throw new ProvisionUserException("SPONSOR_NOT_FOUND");
    sponsorId = sponsor.id;
  }

  const ruleJson = withdrawalRuleToJson(
    input.withdrawalRule ?? parseWithdrawalRuleJson(null),
  ) as unknown as Prisma.InputJsonValue;

  const grantData = {
    accountGranted: true,
    withdrawalUnlocked: false,
    withdrawalRule: ruleJson,
  };

  const existing = await findUserByWallet(wallet);
  if (existing) {
    let referrerId: string | undefined;
    if (sponsorId && !existing.referrerId) {
      if (sponsorId === existing.id) {
        throw new ProvisionUserException("SPONSOR_NOT_FOUND");
      }
      if (await wouldCreateReferrerCycle(existing.id, sponsorId)) {
        throw new ProvisionUserException("SPONSOR_NOT_FOUND");
      }
      referrerId = sponsorId;
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...(username ? { username } : {}),
        ...grantData,
        ...(referrerId ? { referrerId } : {}),
      },
    });
    if (referrerId) await syncUserReferralChain(existing.id);

    const withMeta = await prisma.user.findUnique({
      where: { id: existing.id },
      include: {
        referrer: { select: { walletAddress: true, username: true } },
        _count: { select: { downline: true } },
      },
    });
    if (!withMeta) return serializeUser(existing);
    return serializeUser(withMeta, {
      referrerWallet: withMeta.referrer?.walletAddress ?? null,
      referrerUsername: withMeta.referrer?.username ?? null,
      directReferrals: withMeta._count.downline,
    });
  }

  const created = await prisma.user.create({
    data: {
      walletAddress: wallet,
      username,
      referralCode: await generateUniqueReferralCode(),
      referrerId: sponsorId,
      role: isAdminWallet(wallet) ? "ADMIN" : "USER",
      ...grantData,
    },
  });
  if (sponsorId) await syncUserReferralChain(created.id);

  const withMeta = await prisma.user.findUnique({
    where: { id: created.id },
    include: {
      referrer: { select: { walletAddress: true, username: true } },
      _count: { select: { downline: true } },
    },
  });
  if (!withMeta) return serializeUser(created);
  return serializeUser(withMeta, {
    referrerWallet: withMeta.referrer?.walletAddress ?? null,
    referrerUsername: withMeta.referrer?.username ?? null,
    directReferrals: withMeta._count.downline,
  });
}

export async function adminUpdateUserGrant(input: {
  userId: string;
  withdrawalRule: WithdrawalRule;
  withdrawalUnlocked?: boolean;
}): Promise<UserDto> {
  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: {
      accountGranted: true,
      withdrawalUnlocked: input.withdrawalUnlocked ?? false,
      withdrawalRule: withdrawalRuleToJson(
        input.withdrawalRule,
      ) as unknown as Prisma.InputJsonValue,
    },
  });
  const withMeta = await prisma.user.findUnique({
    where: { id: updated.id },
    include: {
      referrer: { select: { walletAddress: true, username: true } },
      _count: { select: { downline: true } },
    },
  });
  if (!withMeta) return serializeUser(updated);
  return serializeUser(withMeta, {
    referrerWallet: withMeta.referrer?.walletAddress ?? null,
    referrerUsername: withMeta.referrer?.username ?? null,
    directReferrals: withMeta._count.downline,
  });
}

export async function listBalanceAdjustmentsForUser(
  userId: string,
  sinceMs = 0,
): Promise<BalanceAdjustmentDto[]> {
  const since = sinceMs > 0 ? new Date(sinceMs) : new Date(0);
  const rows = await prisma.adminAction.findMany({
    where: {
      targetUserId: userId,
      action: "ADJUST_BALANCE",
      createdAt: { gt: since },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return rows.map((row) => {
    const payload = row.payload as {
      delta?: number;
      note?: string;
      target?: BalanceAdjustmentTarget;
    };
    return {
      id: row.id,
      amount: payload.delta ?? 0,
      note: payload.note ?? "",
      target: payload.target ?? "WITHDRAWABLE",
      createdAt: row.createdAt.toISOString(),
    };
  });
}
