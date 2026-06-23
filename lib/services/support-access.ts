import { prisma } from "@/lib/db";
import { normalizeWallet } from "@/lib/auth/admins";
import type { SessionUser } from "@/lib/auth/require-session";
import { findUserByWallet } from "@/lib/services/users";

export async function ticketBelongsToSession(
  ticket: {
    userId: string | null;
    wallet: string | null;
    email: string;
  },
  session: SessionUser,
): Promise<boolean> {
  const wallet = normalizeWallet(session.address);
  if (ticket.wallet && normalizeWallet(ticket.wallet) === wallet) return true;
  if (session.dbUserId && ticket.userId === session.dbUserId) return true;

  const user =
    session.dbUserId
      ? await prisma.user.findUnique({ where: { id: session.dbUserId } })
      : await findUserByWallet(wallet);

  if (user?.email && ticket.email.toLowerCase() === user.email.toLowerCase()) {
    return true;
  }

  return false;
}

export function userTicketOrFilters(session: SessionUser) {
  const wallet = normalizeWallet(session.address);
  const orFilters: Array<Record<string, string>> = [{ wallet }];
  if (session.dbUserId) orFilters.push({ userId: session.dbUserId });
  return orFilters;
}
