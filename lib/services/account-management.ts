import type { AccountDeletionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const GRACE_PERIOD_DAYS = 30;

export interface AccountDeletionRequestDto {
  id: string;
  userId: string;
  walletAddress: string;
  username: string | null;
  status: AccountDeletionStatus;
  reason: string | null;
  requestedAt: string;
  scheduledFor: string | null;
  processedAt: string | null;
}

export interface UserProfileUpdateInput {
  username?: string;
  email?: string | null;
  /** IB-only. Pass null or "" to clear. */
  avatarUrl?: string | null;
}

export class AccountManagementError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "USERNAME_TAKEN"
      | "DELETION_PENDING"
      | "ALREADY_REQUESTED"
      | "INVALID_STATUS"
      | "NOT_IB"
      | "INVALID_AVATAR_URL",
  ) {
    super(code);
    this.name = "AccountManagementError";
  }
}

async function assertUsernameAvailable(
  username: string,
  excludeUserId: string,
): Promise<void> {
  const owner = await prisma.user.findFirst({
    where: {
      username: { equals: username.trim(), mode: "insensitive" },
      NOT: { id: excludeUserId },
    },
    select: { id: true },
  });
  if (owner) throw new AccountManagementError("USERNAME_TAKEN");
}

export async function updateUserProfile(
  userId: string,
  input: UserProfileUpdateInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { ibAgreement: { select: { isIb: true } } },
  });
  if (!user) throw new AccountManagementError("NOT_FOUND");

  const deletion = await prisma.accountDeletionRequest.findUnique({
    where: { userId },
  });
  if (
    deletion &&
    deletion.status !== "CANCELLED" &&
    deletion.status !== "COMPLETED"
  ) {
    throw new AccountManagementError("DELETION_PENDING");
  }

  if (input.username !== undefined) {
    await assertUsernameAvailable(input.username, userId);
  }

  let nextAvatar: string | null | undefined;
  if (input.avatarUrl !== undefined) {
    const { normalizeAvatarUrl, AvatarUrlError } = await import(
      "@/lib/user/avatar"
    );
    try {
      nextAvatar = normalizeAvatarUrl(input.avatarUrl);
    } catch (err) {
      if (err instanceof AvatarUrlError) {
        throw new AccountManagementError("INVALID_AVATAR_URL");
      }
      throw err;
    }
    if (nextAvatar != null && user.ibAgreement?.isIb !== true) {
      throw new AccountManagementError("NOT_IB");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.username !== undefined
        ? { username: input.username.trim() || null }
        : {}),
      ...(input.email !== undefined
        ? { email: input.email?.trim().toLowerCase() || null }
        : {}),
      ...(nextAvatar !== undefined ? { avatarUrl: nextAvatar } : {}),
    },
  });
}

export async function requestAccountDeletion(input: {
  userId: string;
  reason?: string | null;
}): Promise<AccountDeletionRequestDto> {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new AccountManagementError("NOT_FOUND");

  const existing = await prisma.accountDeletionRequest.findUnique({
    where: { userId: input.userId },
  });
  if (
    existing &&
    existing.status !== "CANCELLED" &&
    existing.status !== "COMPLETED"
  ) {
    throw new AccountManagementError("ALREADY_REQUESTED");
  }

  const scheduledFor = new Date();
  scheduledFor.setDate(scheduledFor.getDate() + GRACE_PERIOD_DAYS);

  const row = await prisma.accountDeletionRequest.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      reason: input.reason?.trim() || null,
      status: "GRACE_PERIOD",
      scheduledFor,
    },
    update: {
      reason: input.reason?.trim() || null,
      status: "GRACE_PERIOD",
      requestedAt: new Date(),
      scheduledFor,
      processedAt: null,
      processedById: null,
    },
    include: {
      user: { select: { walletAddress: true, username: true } },
    },
  });

  return serializeDeletionRequest(row);
}

export async function cancelAccountDeletion(userId: string): Promise<void> {
  const existing = await prisma.accountDeletionRequest.findUnique({
    where: { userId },
  });
  if (!existing) throw new AccountManagementError("NOT_FOUND");
  if (existing.status === "COMPLETED") {
    throw new AccountManagementError("INVALID_STATUS");
  }

  await prisma.accountDeletionRequest.update({
    where: { userId },
    data: { status: "CANCELLED" },
  });
}

export async function getDeletionRequestForUser(
  userId: string,
): Promise<AccountDeletionRequestDto | null> {
  const row = await prisma.accountDeletionRequest.findUnique({
    where: { userId },
    include: { user: { select: { walletAddress: true, username: true } } },
  });
  if (!row || row.status === "CANCELLED") return null;
  return serializeDeletionRequest(row);
}

export async function listDeletionRequests(): Promise<AccountDeletionRequestDto[]> {
  const rows = await prisma.accountDeletionRequest.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: { requestedAt: "desc" },
    take: 200,
    include: { user: { select: { walletAddress: true, username: true } } },
  });
  return rows.map(serializeDeletionRequest);
}

export async function adminUpdateUserProfile(input: {
  adminId: string;
  userId: string;
  username?: string;
  email?: string | null;
  avatarUrl?: string | null;
}): Promise<void> {
  await updateUserProfile(input.userId, {
    username: input.username,
    email: input.email,
    avatarUrl: input.avatarUrl,
  });

  await prisma.adminAction.create({
    data: {
      adminId: input.adminId,
      targetUserId: input.userId,
      action: "UPDATE_USER_PROFILE",
      payload: {
        username: input.username ?? null,
        email: input.email ?? null,
        avatarUrl:
          input.avatarUrl === undefined
            ? undefined
            : input.avatarUrl?.trim() || null,
      },
    },
  });
}

export async function adminProcessDeletionRequest(input: {
  adminId: string;
  userId: string;
  action: "approve" | "cancel";
}): Promise<AccountDeletionRequestDto> {
  const existing = await prisma.accountDeletionRequest.findUnique({
    where: { userId: input.userId },
    include: { user: true },
  });
  if (!existing) throw new AccountManagementError("NOT_FOUND");

  if (input.action === "cancel") {
    const row = await prisma.accountDeletionRequest.update({
      where: { userId: input.userId },
      data: { status: "CANCELLED", processedAt: new Date(), processedById: input.adminId },
      include: { user: { select: { walletAddress: true, username: true } } },
    });
    await prisma.adminAction.create({
      data: {
        adminId: input.adminId,
        targetUserId: input.userId,
        action: "PROCESS_ACCOUNT_DELETION",
        payload: { action: "cancelled" },
      },
    });
    return serializeDeletionRequest(row);
  }

  const row = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        isActive: false,
        username: null,
        email: null,
        avatarUrl: null,
      },
    });

    return tx.accountDeletionRequest.update({
      where: { userId: input.userId },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
        processedById: input.adminId,
      },
      include: { user: { select: { walletAddress: true, username: true } } },
    });
  });

  await prisma.adminAction.create({
    data: {
      adminId: input.adminId,
      targetUserId: input.userId,
      action: "PROCESS_ACCOUNT_DELETION",
      payload: { action: "completed" },
    },
  });

  return serializeDeletionRequest(row);
}

/** Admin directly deactivates and clears account data (no user request required). */
export async function adminDeleteUserAccount(input: {
  adminId: string;
  userId: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new AccountManagementError("NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        isActive: false,
        username: null,
        email: null,
        avatarUrl: null,
      },
    });

    await tx.accountDeletionRequest.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        status: "COMPLETED",
        processedAt: new Date(),
        processedById: input.adminId,
      },
      update: {
        status: "COMPLETED",
        processedAt: new Date(),
        processedById: input.adminId,
      },
    });
  });

  await prisma.adminAction.create({
    data: {
      adminId: input.adminId,
      targetUserId: input.userId,
      action: "PROCESS_ACCOUNT_DELETION",
      payload: { action: "admin_direct_delete" },
    },
  });
}

function serializeDeletionRequest(row: {
  id: string;
  userId: string;
  status: AccountDeletionStatus;
  reason: string | null;
  requestedAt: Date;
  scheduledFor: Date | null;
  processedAt: Date | null;
  user: { walletAddress: string; username: string | null };
}): AccountDeletionRequestDto {
  return {
    id: row.id,
    userId: row.userId,
    walletAddress: row.user.walletAddress,
    username: row.user.username,
    status: row.status,
    reason: row.reason,
    requestedAt: row.requestedAt.toISOString(),
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    processedAt: row.processedAt?.toISOString() ?? null,
  };
}
