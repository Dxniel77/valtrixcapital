import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { ticketSchema, type SupportTicket } from "@/lib/support/ticket-schema";
import { t } from "@/lib/i18n";

const tickets: SupportTicket[] = [];

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`support:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: t("api.rateLimited") },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  let parsed;
  try {
    parsed = ticketSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: t("api.validationFailed"), details: err.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  const ticket: SupportTicket = {
    ...parsed,
    wallet: parsed.wallet || undefined,
    id: `tkt_${Date.now().toString(36)}`,
    createdAt: Date.now(),
    status: "open",
  };

  tickets.unshift(ticket);
  if (tickets.length > 500) tickets.length = 500;

  return NextResponse.json({
    ok: true,
    ticket: { id: ticket.id, createdAt: ticket.createdAt },
  });
}
