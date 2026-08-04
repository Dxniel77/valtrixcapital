import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getAdminActorId } from "@/lib/services/admin";
import {
  assignIbStrategy,
  IbStrategyServiceError,
} from "@/lib/services/ib-strategy";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  strategyId: z.string().uuid().nullable(),
});

/** POST — assign or clear IB strategy on a user. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  const adminId = await getAdminActorId(auth.session.address);
  if (!adminId) {
    return NextResponse.json({ error: "Admin user record missing" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const result = await assignIbStrategy({
      adminUserId: adminId,
      targetUserId: id,
      strategyId: parsed.strategyId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof IbStrategyServiceError) {
      const status =
        err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    throw err;
  }
}
