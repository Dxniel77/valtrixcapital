import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listUserTrades, openTrade, TradeServiceError } from "@/lib/services/trades";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const openSchema = z.object({
  pair: z.string().min(3).max(32),
  direction: z.enum(["UP", "DOWN"]),
  entryPrice: z.number().positive(),
  durationSec: z.number().int().min(30).max(86_400),
});

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ backend: false, trades: [] });
  }

  const trades = await listUserTrades(auth.session.dbUserId);
  return NextResponse.json({ backend: true, trades });
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let parsed;
  try {
    parsed = openSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const trade = await openTrade({
      userId: auth.session.dbUserId,
      pair: parsed.pair,
      direction: parsed.direction,
      entryPrice: parsed.entryPrice,
      durationSec: parsed.durationSec,
    });
    return NextResponse.json({ ok: true, trade });
  } catch (err) {
    if (err instanceof TradeServiceError) {
      const status =
        err.code === "NOT_FOUND"
          ? 404
          : err.code === "INACTIVE" || err.code === "FORBIDDEN"
            ? 403
            : 409;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
