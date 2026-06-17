import { NextResponse } from "next/server";
import {
  fetchLiquidationChainTxs,
  warmLiquidationTxCache,
} from "@/lib/liquidation-engine/fetch-txs";

export const dynamic = "force-dynamic";

// Pre-warm on cold server start so the first dashboard hit is not blocked.
warmLiquidationTxCache();

export async function GET() {
  const data = await fetchLiquidationChainTxs();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
