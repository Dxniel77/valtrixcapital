import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listAdminAudit } from "@/lib/services/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, audit: [] });
  }

  const requested = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(requested) ? requested : 1000;
  const audit = await listAdminAudit(limit);
  return NextResponse.json({ backend: true, audit });
}
