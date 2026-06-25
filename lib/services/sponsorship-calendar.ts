import type { SponsorshipPeriodStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fromMicro, toMicro } from "@/lib/utils";
import { createInboxNotification } from "@/lib/services/inbox-notifications";
import { resolveUnlockVolumes } from "@/lib/services/unlock-volume";

export interface SponsorshipDurationRuleDto {
  id: string;
  minAmount: number;
  durationDays: number;
  label: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface SponsorshipPeriodDto {
  id: string;
  userId: string;
  walletAddress?: string;
  username?: string | null;
  amount: number;
  startDate: string;
  endDate: string;
  status: SponsorshipPeriodStatus;
  remainingDays: number;
  ruleLabel: string | null;
  notes: string | null;
  requirementsMetAt: string | null;
}

const EXPIRING_SOON_DAYS = 7;
const ACTIVE_STATUSES: SponsorshipPeriodStatus[] = ["ACTIVE", "EXPIRING_SOON"];

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysUntil(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function computeStatus(
  endDate: Date,
  current: SponsorshipPeriodStatus,
): SponsorshipPeriodStatus {
  if (
    current === "SUSPENDED" ||
    current === "RENEWED" ||
    current === "REQUIREMENTS_MET" ||
    current === "REQUIREMENTS_FAILED"
  ) {
    return current;
  }
  const remaining = daysUntil(endDate);
  if (remaining <= 0) return "EXPIRED";
  if (remaining <= EXPIRING_SOON_DAYS) return "EXPIRING_SOON";
  return "ACTIVE";
}

function serializeRule(row: {
  id: string;
  minAmountMicro: bigint;
  durationDays: number;
  label: string | null;
  isActive: boolean;
  sortOrder: number;
}): SponsorshipDurationRuleDto {
  return {
    id: row.id,
    minAmount: fromMicro(row.minAmountMicro),
    durationDays: row.durationDays,
    label: row.label,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

function serializePeriod(
  row: {
    id: string;
    userId: string;
    amountMicro: bigint;
    startDate: Date;
    endDate: Date;
    status: SponsorshipPeriodStatus;
    notes: string | null;
    requirementsMetAt: Date | null;
    user?: { walletAddress: string; username: string | null };
    rule?: { label: string | null } | null;
  },
): SponsorshipPeriodDto {
  const status = computeStatus(row.endDate, row.status);
  return {
    id: row.id,
    userId: row.userId,
    walletAddress: row.user?.walletAddress,
    username: row.user?.username ?? null,
    amount: fromMicro(row.amountMicro),
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    status,
    remainingDays: daysUntil(row.endDate),
    ruleLabel: row.rule?.label ?? null,
    notes: row.notes,
    requirementsMetAt: row.requirementsMetAt?.toISOString() ?? null,
  };
}

/** Returns true when a sponsored user has met withdrawal unlock requirements. */
export async function userMeetsSponsorshipRequirements(
  userId: string,
): Promise<boolean> {
  await resolveUnlockVolumes(userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountGranted: true, withdrawalUnlocked: true },
  });
  if (!user?.accountGranted) return true;
  return user.withdrawalUnlocked;
}

export async function listDurationRules(): Promise<SponsorshipDurationRuleDto[]> {
  const rows = await prisma.sponsorshipDurationRule.findMany({
    orderBy: [{ sortOrder: "asc" }, { minAmountMicro: "desc" }],
  });
  return rows.map(serializeRule);
}

export async function resolveDurationRule(
  amountUsd: number,
): Promise<{ ruleId: string | null; durationDays: number; label: string | null }> {
  const amountMicro = toMicro(amountUsd);
  const rule = await prisma.sponsorshipDurationRule.findFirst({
    where: { isActive: true, minAmountMicro: { lte: amountMicro } },
    orderBy: { minAmountMicro: "desc" },
  });
  if (!rule) {
    return { ruleId: null, durationDays: 30, label: null };
  }
  return {
    ruleId: rule.id,
    durationDays: rule.durationDays,
    label: rule.label,
  };
}

export async function createDurationRule(input: {
  minAmount: number;
  durationDays: number;
  label?: string | null;
  sortOrder?: number;
}): Promise<SponsorshipDurationRuleDto> {
  const row = await prisma.sponsorshipDurationRule.create({
    data: {
      minAmountMicro: toMicro(input.minAmount),
      durationDays: input.durationDays,
      label: input.label?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return serializeRule(row);
}

export async function updateDurationRule(input: {
  id: string;
  minAmount?: number;
  durationDays?: number;
  label?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<SponsorshipDurationRuleDto> {
  const row = await prisma.sponsorshipDurationRule.update({
    where: { id: input.id },
    data: {
      ...(input.minAmount !== undefined
        ? { minAmountMicro: toMicro(input.minAmount) }
        : {}),
      ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
      ...(input.label !== undefined ? { label: input.label?.trim() || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
  return serializeRule(row);
}

export async function createSponsorshipPeriod(input: {
  userId: string;
  amountUsd: number;
  createdById?: string | null;
  notes?: string | null;
  startDate?: Date;
  /** Days allowed to meet withdrawal requirements (overrides calendar rule). */
  requirementDeadlineDays?: number;
}): Promise<SponsorshipPeriodDto> {
  const resolved = await resolveDurationRule(input.amountUsd);
  const durationDays = input.requirementDeadlineDays ?? resolved.durationDays;
  const startDate = input.startDate ?? new Date();
  const endDate = addDays(startDate, durationDays);

  const row = await prisma.sponsorshipPeriod.create({
    data: {
      userId: input.userId,
      ruleId: resolved.ruleId,
      amountMicro: toMicro(input.amountUsd),
      startDate,
      endDate,
      status: "ACTIVE",
      notes: input.notes?.trim() || null,
      createdById: input.createdById ?? null,
    },
    include: {
      user: { select: { walletAddress: true, username: true } },
      rule: { select: { label: true } },
    },
  });

  if (input.createdById) {
    await prisma.adminAction.create({
      data: {
        adminId: input.createdById,
        targetUserId: input.userId,
        action: "UPDATE_SPONSORSHIP",
        payload: {
          action: "create_period",
          amount: input.amountUsd,
          durationDays,
          endDate: endDate.toISOString(),
          requirementDeadline: true,
        },
      },
    });
  }

  return serializePeriod(row);
}

export async function getActivePeriodForUser(
  userId: string,
): Promise<SponsorshipPeriodDto | null> {
  const row = await prisma.sponsorshipPeriod.findFirst({
    where: {
      userId,
      status: { in: [...ACTIVE_STATUSES, "REQUIREMENTS_MET"] },
    },
    orderBy: { endDate: "desc" },
    include: {
      user: { select: { walletAddress: true, username: true } },
      rule: { select: { label: true } },
    },
  });
  if (!row) return null;
  return serializePeriod(row);
}

export async function listSponsorshipPeriods(input?: {
  from?: Date;
  to?: Date;
  status?: SponsorshipPeriodStatus;
}): Promise<SponsorshipPeriodDto[]> {
  const rows = await prisma.sponsorshipPeriod.findMany({
    where: {
      ...(input?.status ? { status: input.status } : {}),
      ...(input?.from || input?.to
        ? {
            endDate: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { endDate: "asc" },
    take: 500,
    include: {
      user: { select: { walletAddress: true, username: true } },
      rule: { select: { label: true } },
    },
  });
  return rows.map(serializePeriod);
}

export async function renewSponsorshipPeriod(input: {
  adminId: string;
  userId: string;
  amountUsd: number;
  notes?: string | null;
  requirementDeadlineDays?: number;
}): Promise<SponsorshipPeriodDto> {
  await prisma.sponsorshipPeriod.updateMany({
    where: {
      userId: input.userId,
      status: { in: [...ACTIVE_STATUSES, "EXPIRED", "REQUIREMENTS_FAILED"] },
    },
    data: { status: "RENEWED" },
  });

  return createSponsorshipPeriod({
    userId: input.userId,
    amountUsd: input.amountUsd,
    createdById: input.adminId,
    notes: input.notes ?? "Renewed sponsorship",
    requirementDeadlineDays: input.requirementDeadlineDays,
  });
}

export async function runSponsorshipExpirationCron(): Promise<{
  updated: number;
  notifications: number;
  disabled: number;
}> {
  let notifications = 0;
  let disabled = 0;

  const periods = await prisma.sponsorshipPeriod.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    include: {
      user: {
        select: {
          id: true,
          walletAddress: true,
          accountGranted: true,
          isActive: true,
        },
      },
    },
  });

  let updated = 0;
  for (const period of periods) {
    if (!period.user.accountGranted) continue;

    const requirementsMet = await userMeetsSponsorshipRequirements(period.userId);
    if (requirementsMet) {
      await prisma.sponsorshipPeriod.update({
        where: { id: period.id },
        data: {
          status: "REQUIREMENTS_MET",
          requirementsMetAt: period.requirementsMetAt ?? new Date(),
        },
      });
      updated++;
      continue;
    }

    const nextStatus = computeStatus(period.endDate, period.status);
    if (nextStatus !== period.status) {
      await prisma.sponsorshipPeriod.update({
        where: { id: period.id },
        data: { status: nextStatus },
      });
      updated++;
    }

    const remaining = daysUntil(period.endDate);
    const alertDays = [7, 3, 1, 0];
    if (alertDays.includes(remaining)) {
      const dedupeKey = `sponsor_expiry_${period.userId}_${period.id}_${remaining}`;
      const created = await createInboxNotification({
        audience: "USER",
        userId: period.user.id,
        wallet: period.user.walletAddress,
        kind: "system",
        eventKey:
          remaining === 0
            ? "sponsorshipExpired"
            : "sponsorshipExpiringSoon",
        params: { days: String(remaining) },
        href: "/dashboard/profile",
        dedupeKey,
      });
      if (created) notifications++;
    }

    if (remaining <= 0 && period.user.isActive) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: period.userId },
          data: { isActive: false },
        }),
        prisma.sponsorshipPeriod.update({
          where: { id: period.id },
          data: { status: "REQUIREMENTS_FAILED" },
        }),
      ]);
      disabled++;
      updated++;

      await createInboxNotification({
        audience: "USER",
        userId: period.user.id,
        wallet: period.user.walletAddress,
        kind: "system",
        eventKey: "sponsorshipRequirementsFailed",
        params: {},
        href: "/dashboard/profile",
        dedupeKey: `sponsor_failed_${period.userId}_${period.id}`,
      });
    }
  }

  return { updated, notifications, disabled };
}
