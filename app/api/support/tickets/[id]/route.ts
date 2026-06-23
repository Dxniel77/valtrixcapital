import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getUserSupportTicket } from "@/lib/services/support-tickets";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const ticket = await getUserSupportTicket(id, auth.session);
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ backend: true, ticket });
}
