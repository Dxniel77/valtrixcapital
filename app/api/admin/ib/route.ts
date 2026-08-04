import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listIbAgreements } from "@/lib/services/ib-net-deposit";
import { listIbStrategies } from "@/lib/services/ib-strategy";

export const dynamic = "force-dynamic";

/** GET — IB monitor (agreements) + yield strategies. */
export async function GET() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const [agreements, strategies] = await Promise.all([
    listIbAgreements(),
    listIbStrategies(),
  ]);

  return NextResponse.json({ ok: true, agreements, strategies });
}
