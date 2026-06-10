import { NextResponse } from "next/server";
import { fetchRecentChainTxs } from "@/lib/bot/explorer";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await fetchRecentChainTxs();
  return NextResponse.json(data);
}
