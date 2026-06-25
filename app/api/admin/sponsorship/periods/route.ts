import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listSponsorshipPeriods } from "@/lib/services/sponsorship-calendar";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const status = searchParams.get("status") as
    | "ACTIVE"
    | "EXPIRING_SOON"
    | "EXPIRED"
    | "RENEWED"
    | "SUSPENDED"
    | null;

  const periods = await listSponsorshipPeriods({
    from: fromStr ? new Date(fromStr) : undefined,
    to: toStr ? new Date(toStr) : undefined,
    status: status ?? undefined,
  });

  return NextResponse.json({ periods });
}
