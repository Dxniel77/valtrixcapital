import { NextResponse } from "next/server";
import { fetchLiquidationChainTxs } from "@/lib/liquidation-engine/fetch-txs";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await fetchLiquidationChainTxs();
  return NextResponse.json(data);
}
