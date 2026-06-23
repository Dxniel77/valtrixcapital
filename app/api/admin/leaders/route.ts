import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listAdminLeaderRows, type LeaderPeriod } from "@/lib/services/admin-leaders";

export const dynamic = "force-dynamic";

const periodSchema = z.enum(["week", "month", "3months"]);

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({
      backend: false,
      rows: [],
      directAccounts: {
        accountCount: 0,
        total: 0,
        operational: 0,
        network: 0,
        passive: 0,
        tradesCount: 0,
        winsCount: 0,
      },
    });
  }

  const url = new URL(req.url);
  const periodRaw = url.searchParams.get("period") ?? "week";
  let period: LeaderPeriod = "week";
  try {
    period = periodSchema.parse(periodRaw);
  } catch {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const data = await listAdminLeaderRows(period);
  return NextResponse.json({ backend: true, ...data });
}
