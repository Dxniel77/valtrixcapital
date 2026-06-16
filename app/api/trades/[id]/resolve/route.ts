import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { resolveTrade, TradeServiceError } from "@/lib/services/trades";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const resolveSchema = z.object({
  exitPrice: z.number().positive(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { id } = await ctx.params;

  let parsed;
  try {
    parsed = resolveSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const trade = await resolveTrade({
      userId: auth.session.dbUserId,
      tradeId: id,
      exitPrice: parsed.exitPrice,
    });
    return NextResponse.json({ ok: true, trade });
  } catch (err) {
    if (err instanceof TradeServiceError) {
      const status =
        err.code === "NOT_FOUND"
          ? 404
          : err.code === "ALREADY_RESOLVED"
            ? 409
            : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
