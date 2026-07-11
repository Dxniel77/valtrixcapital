import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listUserCopyInvestments } from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ backend: false, investments: [] });
  }

  const investments = await listUserCopyInvestments(auth.session.dbUserId);
  return NextResponse.json({ backend: true, investments });
}
