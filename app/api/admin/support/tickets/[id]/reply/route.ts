import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { replyToSupportTicket } from "@/lib/services/support-tickets";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().trim().min(2).max(4000),
  notifyUser: z.boolean().optional().default(true),
});

export async function POST(
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
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ticket = await replyToSupportTicket({
    ticketId: id,
    adminId: auth.session.sub,
    body: parsed.message,
    notifyUser: parsed.notifyUser,
  });

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ticket });
}
