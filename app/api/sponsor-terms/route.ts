import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  getActiveSponsorTerms,
  getPendingTermsForUser,
} from "@/lib/services/sponsor-terms";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, pending: null, active: null });
  }

  const dbUserId = auth.session.dbUserId;
  if (!dbUserId) {
    return NextResponse.json({ backend: true, pending: null, active: null });
  }

  const [pending, active] = await Promise.all([
    getPendingTermsForUser(dbUserId),
    getActiveSponsorTerms(),
  ]);

  return NextResponse.json({ backend: true, pending, active });
}
