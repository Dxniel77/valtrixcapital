import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/available";
import { ensureCopyTradingConfig } from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, config: null });
  }

  const config = await ensureCopyTradingConfig();
  return NextResponse.json({ backend: true, config });
}
