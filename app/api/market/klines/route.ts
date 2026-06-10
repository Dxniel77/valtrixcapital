import { NextRequest, NextResponse } from "next/server";
import { resolveKlines } from "@/lib/exchanges/resolve-market";
import type { Timeframe } from "@/lib/market/pairs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TIMEFRAMES = new Set<Timeframe>(["1m", "5m", "15m", "1h", "4h", "1D"]);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const timeframe = searchParams.get("timeframe") as Timeframe | null;
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "300", 10) || 300, 1),
    1000,
  );
  const preferred = searchParams.get("source");

  if (!symbol || !timeframe || !TIMEFRAMES.has(timeframe)) {
    return NextResponse.json(
      { error: "symbol and valid timeframe are required" },
      { status: 400 },
    );
  }

  try {
    const { data: candles, source } = await resolveKlines(
      symbol,
      timeframe,
      limit,
      preferred,
    );
    return NextResponse.json({ candles, source });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load market klines",
      },
      { status: 502 },
    );
  }
}
