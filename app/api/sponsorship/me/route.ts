import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getActivePeriodForUser } from "@/lib/services/sponsorship-calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, period: null });
  }

  const dbUserId = auth.session.dbUserId;
  if (!dbUserId) {
    return NextResponse.json({ backend: true, period: null });
  }

  const period = await getActivePeriodForUser(dbUserId);
  return NextResponse.json({ backend: true, period });
}
