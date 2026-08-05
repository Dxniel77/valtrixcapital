import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/available";
import { runCopyTradingSimulation } from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const result = await runCopyTradingSimulation();
  return NextResponse.json({ ok: true, ...result });
}

export const POST = GET;
