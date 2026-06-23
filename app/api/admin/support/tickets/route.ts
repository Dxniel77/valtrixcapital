import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listSupportTickets } from "@/lib/services/support-tickets";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, tickets: [] });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? "100");

  const tickets = await listSupportTickets({ status, limit });

  return NextResponse.json({ backend: true, tickets });
}
