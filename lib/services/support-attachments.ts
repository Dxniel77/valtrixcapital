import { prisma } from "@/lib/db";
import { normalizeWallet } from "@/lib/auth/admins";
import {
  MAX_SUPPORT_ATTACHMENT_BYTES,
  MAX_SUPPORT_ATTACHMENTS_PER_MESSAGE,
  SUPPORT_ATTACHMENT_MIME_TYPES,
} from "@/lib/support/constants";
import type { SessionUser } from "@/lib/auth/require-session";
import { ticketBelongsToSession } from "@/lib/services/support-access";

export interface SupportAttachmentDto {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  url: string;
}

function serializeAttachment(row: {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}): SupportAttachmentDto {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.getTime(),
    url: `/api/support/attachments/${row.id}`,
  };
}

export function isAllowedSupportMimeType(mimeType: string): boolean {
  return (SUPPORT_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

export async function saveSupportAttachments(
  files: File[],
  input: {
    ticketId?: string;
    replyId?: string;
    uploaderWallet: string;
  },
): Promise<SupportAttachmentDto[]> {
  const wallet = normalizeWallet(input.uploaderWallet);
  const batch = files.slice(0, MAX_SUPPORT_ATTACHMENTS_PER_MESSAGE);
  const saved: SupportAttachmentDto[] = [];

  for (const file of batch) {
    if (file.size <= 0 || file.size > MAX_SUPPORT_ATTACHMENT_BYTES) continue;
    if (!isAllowedSupportMimeType(file.type)) continue;

    const buffer = Buffer.from(await file.arrayBuffer());
    const row = await prisma.supportTicketAttachment.create({
      data: {
        ticketId: input.ticketId ?? null,
        replyId: input.replyId ?? null,
        uploaderWallet: wallet,
        fileName: file.name.slice(0, 200),
        mimeType: file.type,
        sizeBytes: file.size,
        data: buffer,
      },
    });
    saved.push(serializeAttachment(row));
  }

  return saved;
}

export async function getSupportAttachmentForDownload(
  id: string,
  session: SessionUser,
  isAdmin: boolean,
): Promise<{ data: Buffer; mimeType: string; fileName: string } | null> {
  const row = await prisma.supportTicketAttachment.findUnique({
    where: { id },
    include: {
      ticket: true,
      reply: { include: { ticket: true } },
    },
  });
  if (!row) return null;

  const ticket = row.ticket ?? row.reply?.ticket;
  if (!ticket) return null;

  if (!isAdmin) {
    const allowed = await ticketBelongsToSession(ticket, session);
    if (!allowed) return null;
  }

  return {
    data: Buffer.from(row.data),
    mimeType: row.mimeType,
    fileName: row.fileName,
  };
}
