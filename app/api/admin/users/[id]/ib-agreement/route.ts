import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getAdminActorId } from "@/lib/services/admin";
import {
  getIbAgreementForUser,
  IbNetDepositError,
  upsertIbAgreement,
} from "@/lib/services/ib-net-deposit";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  isIb: z.boolean().optional().default(true),
  netDepositEnabled: z.boolean().optional().default(false),
  level1DepositBps: z.number().int().min(0).max(10_000).optional().default(0),
  level2DepositBps: z.number().int().min(0).max(10_000).optional().default(0),
  includeLevel2: z.boolean().optional(),
  notes: z.string().max(2000).optional().default(""),
});

/** GET — IB agreement for user. POST — upsert Net Deposit negotiation. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  const { id } = await ctx.params;
  const agreement = await getIbAgreementForUser(id);
  return NextResponse.json({ ok: true, agreement });
}

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
    const agreement = await upsertIbAgreement({
      adminUserId: adminId,
      targetUserId: id,
      ...parsed,
    });
    return NextResponse.json({ ok: true, agreement });
  } catch (err) {
    if (err instanceof IbNetDepositError) {
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
