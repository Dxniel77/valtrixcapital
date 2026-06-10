import { NextRequest, NextResponse } from "next/server";
import { fetchBinanceTicker24h } from "@/lib/exchanges/binance";
import { fetchBybitTicker } from "@/lib/exchanges/bybit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase();
  const preferred = req.nextUrl.searchParams.get("source");

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  if (preferred === "bybit") {
    try {
      const ticker = await fetchBybitTicker(symbol);
      return NextResponse.json({ ticker, source: "bybit" });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to load Bybit ticker",
        },
        { status: 502 },
      );
    }
  }

  try {
    const ticker = await fetchBinanceTicker24h(symbol);
    return NextResponse.json({ ticker, source: "binance" });
  } catch {
    try {
      const ticker = await fetchBybitTicker(symbol);
      return NextResponse.json({ ticker, source: "bybit" });
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
}
