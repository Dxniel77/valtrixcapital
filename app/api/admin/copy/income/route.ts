import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isCopyIncomePeriod } from "@/lib/copy-trading/income-period";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getAdminCopyIncomeReport } from "@/lib/services/copy-income-report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const period = new URL(req.url).searchParams.get("period") ?? "DAY";
  if (!isCopyIncomePeriod(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    ...(await getAdminCopyIncomeReport(period)),
  });
}
