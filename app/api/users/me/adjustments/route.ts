import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listBalanceAdjustmentsForUser } from "@/lib/services/users";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ backend: false, adjustments: [] });
  }

  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") ?? "0");
  const adjustments = await listBalanceAdjustmentsForUser(
    auth.session.dbUserId,
    Number.isFinite(since) ? since : 0,
  );

  return NextResponse.json({ backend: true, adjustments });
}
