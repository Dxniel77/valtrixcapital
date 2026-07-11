import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { CopyTradingError, investInCopyTrader } from "@/lib/services/copy-trading";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const investSchema = z.object({
  traderId: z.string().min(1),
  amount: z.number().positive(),
});

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let parsed;
  try {
    parsed = investSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const investment = await investInCopyTrader({
      userId: auth.session.dbUserId,
      traderId: parsed.traderId,
      amount: parsed.amount,
    });
    return NextResponse.json({ ok: true, investment });
  } catch (err) {
    if (err instanceof CopyTradingError) {
      const status =
        err.code === "NOT_FOUND" || err.code === "TRADER_UNAVAILABLE"
          ? 404
          : err.code === "INSUFFICIENT_BALANCE" || err.code === "INVALID_AMOUNT"
            ? 400
            : err.code === "INACTIVE" || err.code === "FORBIDDEN"
              ? 403
              : 409;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
