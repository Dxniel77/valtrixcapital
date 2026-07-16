import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/available";
import { reconcileAllPendingDeposits } from "@/lib/services/deposits";

export const dynamic = "force-dynamic";

/**
 * Reconciles PENDING deposits platform-wide: re-syncs on-chain confirmations and
 * activates any deposit that has reached the required confirmations. Backstop for
 * deposits whose users left before client-side confirmation polling completed.
 * Secure with CRON_SECRET header in production.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const result = await reconcileAllPendingDeposits();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return POST(req);
}
