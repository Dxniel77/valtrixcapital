import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/available";
import { runDailyYieldCron } from "@/lib/services/yield";

export const dynamic = "force-dynamic";

/**
 * Daily yield accrual cron endpoint.
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

  const result = await runDailyYieldCron();
  return NextResponse.json({ ok: true, ...result });
}

/** Allow GET for manual dev testing without auth when CRON_SECRET is unset. */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET) {
    return POST(req);
  }
  return POST(req);
}
