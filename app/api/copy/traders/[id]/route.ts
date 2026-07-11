import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getCopyTraderDetail } from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, trader: null });
  }

  const trader = await getCopyTraderDetail(id);
  if (!trader) {
    return NextResponse.json({ error: "Trader not found" }, { status: 404 });
  }

  return NextResponse.json({ backend: true, trader });
}
