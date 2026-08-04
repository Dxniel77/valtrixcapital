import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getAdminActorId } from "@/lib/services/admin";
import {
  createIbStrategy,
  IbStrategyServiceError,
  listIbStrategies,
} from "@/lib/services/ib-strategy";
import { t } from "@/lib/i18n";
import { REFERRAL_LEVELS } from "@/lib/referrals/constants";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().default(""),
  passiveBonusBps: z.number().int().min(0).max(10_000).optional().default(0),
  tradeBonusExtraBps: z.number().int().min(0).max(10_000).optional().default(0),
  commissionRatesBps: z
    .array(z.number().int().min(0).max(10_000))
    .length(REFERRAL_LEVELS)
    .nullable()
    .optional(),
  isActive: z.boolean().optional().default(true),
});

/** GET — list IB strategies. POST — create strategy. */
export async function GET() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  const strategies = await listIbStrategies();
  return NextResponse.json({ ok: true, strategies });
}

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  const adminId = await getAdminActorId(auth.session.address);
  if (!adminId) {
    return NextResponse.json({ error: "Admin user record missing" }, { status: 403 });
  }

  let parsed;
  try {
    parsed = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const strategy = await createIbStrategy({
      adminUserId: adminId,
      ...parsed,
      commissionRatesBps: parsed.commissionRatesBps ?? null,
    });
    return NextResponse.json({ ok: true, strategy });
  } catch (err) {
    if (err instanceof IbStrategyServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === "NOT_FOUND" ? 404 : 400 },
      );
    }
    throw err;
  }
}
