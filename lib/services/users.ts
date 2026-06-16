import type { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAdminWallet, normalizeWallet } from "@/lib/auth/admins";
import { fromMicro } from "@/lib/utils";
import { generateUniqueReferralCode } from "@/lib/services/referral-code";

export interface UserDto {
  id: string;
  walletAddress: string;
  username: string | null;
  role: UserRole;
  isActive: boolean;
  referralCode: string;
  referrerId: string | null;
  earningsBalance: number;
  lockedCapital: number;
  totalEarned: number;
  payoutCap: number;
  createdAt: string;
  updatedAt: string;
}

export function serializeUser(user: User): UserDto {
  return {
    id: user.id,
    walletAddress: user.walletAddress,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    referralCode: user.referralCode,
    referrerId: user.referrerId,
    earningsBalance: fromMicro(user.earningsBalance),
    lockedCapital: fromMicro(user.lockedCapital),
    totalEarned: fromMicro(user.totalEarned),
    payoutCap: fromMicro(user.payoutCap),
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
    if (input?.username && !existing.username) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { username: input.username },
      });
    }
    return existing;
  }

  let referrerId: string | null = null;
  if (input?.referrerCode) {
    const sponsor = await prisma.user.findUnique({
      where: { referralCode: input.referrerCode.trim().toUpperCase() },
      select: { id: true },
    });
    referrerId = sponsor?.id ?? null;
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
  });
}

export async function updateUsername(
  userId: string,
  username: string,
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { username: username.trim() },
  });
}

export async function listUsersForAdmin(): Promise<UserDto[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return users.map(serializeUser);
}

export interface BalanceAdjustmentDto {
  id: string;
  amount: number;
  note: string;
  createdAt: string;
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
    };
    return {
      id: row.id,
      amount: payload.delta ?? 0,
      note: payload.note ?? "",
      createdAt: row.createdAt.toISOString(),
    };
  });
}
