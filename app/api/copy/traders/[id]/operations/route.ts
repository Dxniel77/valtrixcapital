import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getCopyTraderOperations } from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, current: null, history: [] });
  }
  const { id } = await params;
  return NextResponse.json({
    backend: true,
    ...(await getCopyTraderOperations(id)),
  });
}
