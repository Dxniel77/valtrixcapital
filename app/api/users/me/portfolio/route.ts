import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getUserPortfolio } from "@/lib/services/portfolio";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ backend: false, portfolio: null });
  }

  const portfolio = await getUserPortfolio(auth.session.dbUserId);
  return NextResponse.json({ backend: true, portfolio });
}
