import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  defaultReportFromDate,
  defaultReportToDate,
  parseReportDateEnd,
  parseReportDateStart,
} from "@/lib/admin/report-dates";
import { getAdminCashFlowSummary } from "@/lib/services/admin-reports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const url = new URL(req.url);
  const fromKey = url.searchParams.get("from") ?? defaultReportFromDate();
  const toKey = url.searchParams.get("to") ?? defaultReportToDate();
  const fromMs = parseReportDateStart(fromKey);
  const toMs = parseReportDateEnd(toKey);

  const summary = await getAdminCashFlowSummary(fromMs, toMs);
  return NextResponse.json({ ok: true, fromMs, toMs, summary });
}
