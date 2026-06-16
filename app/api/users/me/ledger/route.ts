import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { buildUserLedger } from "@/lib/services/ledger";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ backend: false, entries: [] });
  }

  const entries = await buildUserLedger(auth.session.dbUserId);
  return NextResponse.json({ backend: true, entries });
}
