import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  getCopyTraderStats,
  type CopyTraderStatsPeriod,
} from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const PERIODS = new Set<CopyTraderStatsPeriod>([
  "TODAY",
  "WEEK",
  "MONTH",
  "ALL",
]);

export async function GET(req: Request, { params }: Params) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, stats: null });
  }
  const { id } = await params;
  const periodRaw = new URL(req.url).searchParams.get("period") ?? "ALL";
  const period = PERIODS.has(periodRaw as CopyTraderStatsPeriod)
    ? (periodRaw as CopyTraderStatsPeriod)
    : "ALL";
  const stats = await getCopyTraderStats(id, period);
  return NextResponse.json({ backend: true, stats });
}
