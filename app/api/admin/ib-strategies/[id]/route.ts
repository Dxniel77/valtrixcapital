import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getAdminActorId } from "@/lib/services/admin";
import {
  IbStrategyServiceError,
  updateIbStrategy,
} from "@/lib/services/ib-strategy";
import { t } from "@/lib/i18n";
import { REFERRAL_LEVELS } from "@/lib/referrals/constants";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  passiveBonusBps: z.number().int().min(0).max(10_000).optional(),
  tradeBonusExtraBps: z.number().int().min(0).max(10_000).optional(),
  commissionRatesBps: z
    .array(z.number().int().min(0).max(10_000))
    .length(REFERRAL_LEVELS)
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

/** PATCH — update an IB strategy. */
export async function PATCH(
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
    parsed = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const strategy = await updateIbStrategy({
      adminUserId: adminId,
      strategyId: id,
      ...parsed,
    });
    return NextResponse.json({ ok: true, strategy });
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
