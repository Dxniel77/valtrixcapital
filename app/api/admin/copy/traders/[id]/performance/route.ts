import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { applyTraderPerformanceUpdate, CopyTradingError } from "@/lib/services/copy-trading";
import { findUserByWallet } from "@/lib/services/users";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const schema = z.object({
  period: z.enum(["TODAY", "WEEK", "MONTH", "QUARTER", "YEAR", "ALL_TIME"]),
  returnBps: z.number().int().min(-10_000).max(10_000),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const adminUser = await findUserByWallet(auth.session.address);
  if (!adminUser) {
    return NextResponse.json({ error: "Admin user not found" }, { status: 403 });
  }

  const { id: traderId } = await params;

  let parsed;
  try {
    parsed = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const result = await applyTraderPerformanceUpdate({
      traderId,
      period: parsed.period,
      returnBps: parsed.returnBps,
      adminUserId: adminUser.id,
      idempotencyKey: parsed.idempotencyKey,
      source: "ADMIN",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof CopyTradingError) {
      const status = err.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
