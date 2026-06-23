import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getUserReferralSnapshot } from "@/lib/services/referrals";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ backend: false, snapshot: null });
  }

  const snapshot = await getUserReferralSnapshot(auth.session.dbUserId);
  return NextResponse.json({ backend: true, snapshot });
}
