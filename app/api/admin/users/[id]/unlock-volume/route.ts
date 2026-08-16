import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  AdminServiceError,
  creditUnlockVolume,
  getAdminActorId,
} from "@/lib/services/admin";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amount: z.number().positive().max(1_000_000),
  level: z.enum(["direct", "l2"]).optional().default("direct"),
  note: z.string().max(500).optional().default(""),
});

/** POST — credit unlock progress volume (does not change wallet balances). */
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
    const user = await creditUnlockVolume({
      adminUserId: adminId,
      targetUserId: id,
      amount: parsed.amount,
      level: parsed.level,
      note: parsed.note,
    });
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    if (err instanceof AdminServiceError) {
      const status =
        err.code === "NOT_FOUND"
          ? 404
          : err.code === "FORBIDDEN"
            ? 403
            : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
