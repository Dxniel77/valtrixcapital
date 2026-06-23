import type {
  SupportTicketCategory,
  SupportTicketStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendWithResend } from "@/lib/email/resend";
import {
  createInboxNotification,
  resolveUserIdForTicket,
} from "@/lib/services/inbox-notifications";
import { t } from "@/lib/i18n";
import { SUPPORT_EMAIL } from "@/lib/support/constants";
import type { SupportTicketInput } from "@/lib/support/ticket-schema";
import { ticketCategories } from "@/lib/support/ticket-schema";

const CATEGORY_TO_DB: Record<
  (typeof ticketCategories)[number],
  SupportTicketCategory
> = {
  deposit: "DEPOSIT",
  withdrawal: "WITHDRAWAL",
  trading: "TRADING",
  referrals: "REFERRALS",
  account: "ACCOUNT",
  other: "OTHER",
};

const CATEGORY_FROM_DB: Record<SupportTicketCategory, string> = {
  DEPOSIT: "deposit",
  WITHDRAWAL: "withdrawal",
  TRADING: "trading",
  REFERRALS: "referrals",
  ACCOUNT: "account",
  OTHER: "other",
};

const STATUS_FROM_DB: Record<SupportTicketStatus, string> = {
  OPEN: "open",
  PENDING: "pending",
  RESOLVED: "resolved",
  CLOSED: "closed",
};

const STATUS_TO_DB: Record<string, SupportTicketStatus> = {
  open: "OPEN",
  pending: "PENDING",
  resolved: "RESOLVED",
  closed: "CLOSED",
};

export interface SupportTicketReplyDto {
  id: string;
  body: string;
  isStaff: boolean;
  adminId: string | null;
  createdAt: number;
}

export interface SupportTicketDto {
  id: string;
  name: string;
  email: string;
  wallet: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  replies: SupportTicketReplyDto[];
}

function newTicketId(): string {
  return `tkt_${Date.now().toString(36)}`;
}

function serializeReply(
  reply: {
    id: string;
    body: string;
    isStaff: boolean;
    adminId: string | null;
    createdAt: Date;
  },
): SupportTicketReplyDto {
  return {
    id: reply.id,
    body: reply.body,
    isStaff: reply.isStaff,
    adminId: reply.adminId,
    createdAt: reply.createdAt.getTime(),
  };
}

function serializeTicket(
  ticket: {
    id: string;
    name: string;
    email: string;
    wallet: string | null;
    category: SupportTicketCategory;
    subject: string;
    message: string;
    status: SupportTicketStatus;
    createdAt: Date;
    updatedAt: Date;
    replies?: Array<{
      id: string;
      body: string;
      isStaff: boolean;
      adminId: string | null;
      createdAt: Date;
    }>;
  },
): SupportTicketDto {
  return {
    id: ticket.id,
    name: ticket.name,
    email: ticket.email,
    wallet: ticket.wallet,
    category: CATEGORY_FROM_DB[ticket.category],
    subject: ticket.subject,
    message: ticket.message,
    status: STATUS_FROM_DB[ticket.status],
    createdAt: ticket.createdAt.getTime(),
    updatedAt: ticket.updatedAt.getTime(),
    replies: (ticket.replies ?? []).map(serializeReply),
  };
}

export async function createSupportTicket(
  input: SupportTicketInput,
): Promise<SupportTicketDto> {
  const id = newTicketId();
  const wallet = input.wallet?.trim() || null;

  const ticket = await prisma.supportTicket.create({
    data: {
      id,
      name: input.name,
      email: input.email,
      wallet,
      category: CATEGORY_TO_DB[input.category],
      subject: input.subject,
      message: input.message,
      status: "OPEN",
    },
  });

  const notifyBody = [
    `Ticket: ${id}`,
    `From: ${input.name} <${input.email}>`,
    wallet ? `Wallet: ${wallet}` : null,
    `Category: ${input.category}`,
    `Subject: ${input.subject}`,
    "",
    input.message,
  ]
    .filter(Boolean)
    .join("\n");

  void sendWithResend({
    to: SUPPORT_EMAIL,
    subject: `[Support] ${input.subject} (${id})`,
    body: notifyBody,
  });

  const ticketNewParams = {
    name: input.name,
    subject: input.subject,
    ticketId: id,
  };
  void createInboxNotification({
    audience: "ADMIN",
    kind: "alert",
    eventKey: "supportTicketNew",
    params: {
      ...ticketNewParams,
      title: t("notifications.events.supportTicketNewTitle"),
      body: t("notifications.events.supportTicketNewBody", ticketNewParams),
    },
    href: "/admin/support",
    dedupeKey: `support_ticket_${id}`,
  });

  return serializeTicket(ticket);
}

export async function listSupportTickets(input?: {
  status?: string;
  limit?: number;
}): Promise<SupportTicketDto[]> {
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 500);
  const status =
    input?.status && STATUS_TO_DB[input.status]
      ? STATUS_TO_DB[input.status]
      : undefined;

  const rows = await prisma.supportTicket.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  return rows.map(serializeTicket);
}

export async function getSupportTicket(id: string): Promise<SupportTicketDto | null> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) return null;
  return serializeTicket(ticket);
}

export async function updateSupportTicketStatus(
  id: string,
  status: string,
): Promise<SupportTicketDto | null> {
  const dbStatus = STATUS_TO_DB[status];
  if (!dbStatus) return null;

  try {
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status: dbStatus },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return serializeTicket(ticket);
  } catch {
    return null;
  }
}

export async function replyToSupportTicket(input: {
  ticketId: string;
  adminId: string;
  body: string;
  notifyUser?: boolean;
}): Promise<SupportTicketDto | null> {
  const trimmed = input.body.trim();
  if (trimmed.length < 2) return null;

  const existing = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
  });
  if (!existing) return null;

  const reply = await prisma.supportTicketReply.create({
    data: {
      ticketId: input.ticketId,
      body: trimmed,
      isStaff: true,
      adminId: input.adminId,
    },
  });

  const ticket = await prisma.supportTicket.update({
    where: { id: input.ticketId },
    data: {
      status: existing.status === "OPEN" ? "PENDING" : existing.status,
      updatedAt: new Date(),
    },
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (input.notifyUser) {
    void sendWithResend({
      to: existing.email,
      subject: `Re: ${existing.subject} (${existing.id})`,
      body: [
        `Hello ${existing.name},`,
        "",
        trimmed,
        "",
        `— Valtrix Capital Support`,
        `Ticket reference: ${existing.id}`,
      ].join("\n"),
    });
  }

  const userId = await resolveUserIdForTicket({
    wallet: existing.wallet,
    email: existing.email,
  });

  const preview =
    trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
  const replyParams = {
    ticketId: existing.id,
    subject: existing.subject,
    preview,
  };
  void createInboxNotification({
    audience: "USER",
    userId,
    wallet: existing.wallet,
    email: existing.email,
    kind: "system",
    eventKey: "supportReply",
    params: {
      ...replyParams,
      title: t("notifications.events.supportReplyTitle"),
      body: t("notifications.events.supportReplyBody", replyParams),
    },
    href: "/dashboard/support",
    dedupeKey: `support_reply_${reply.id}`,
  });

  return serializeTicket(ticket);
}

export function countOpenSupportTickets(): Promise<number> {
  return prisma.supportTicket.count({
    where: { status: { in: ["OPEN", "PENDING"] } },
  });
}
