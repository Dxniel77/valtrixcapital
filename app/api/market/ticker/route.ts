import { NextRequest, NextResponse } from "next/server";
import { resolveTicker } from "@/lib/exchanges/resolve-market";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase();
  const preferred = req.nextUrl.searchParams.get("source");

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    const { data: ticker, source } = await resolveTicker(symbol, preferred);
    return NextResponse.json({ ticker, source });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load market ticker",
      },
      { status: 502 },
    );
  }
}
