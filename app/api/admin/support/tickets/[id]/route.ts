import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  getSupportTicket,
  updateSupportTicketStatus,
} from "@/lib/services/support-tickets";
import { ticketStatuses } from "@/lib/support/ticket-schema";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(ticketStatuses),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, ticket: null }, { status: 503 });
  }

  const ticket = await getSupportTicket(id);
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ backend: true, ticket });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let parsed;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ticket = await updateSupportTicketStatus(id, parsed.status);
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ticket });
}
