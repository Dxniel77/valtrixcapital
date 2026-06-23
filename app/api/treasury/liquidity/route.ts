import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getTreasuryLiquidity } from "@/lib/services/treasury";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({
      backend: false,
      bscBalance: 0,
      polygonBalance: 0,
      totalBalance: 0,
    });
  }

  const balances = await getTreasuryLiquidity();
  return NextResponse.json({ backend: true, ...balances });
}
