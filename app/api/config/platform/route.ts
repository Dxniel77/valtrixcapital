import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getPlatformConfig, updatePlatformConfig } from "@/lib/services/config";
import { getAdminActorId } from "@/lib/services/admin";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  baseYieldBps: z.number().int().min(0).max(10_000).optional(),
  bonusPerWinBps: z.number().int().min(0).max(10_000).optional(),
  maxTradesPerDay: z.number().int().min(1).max(100).optional(),
  maxDailyYieldBps: z.number().int().min(0).max(10_000).optional(),
  withdrawalFeeBps: z.number().int().min(0).max(10_000).optional(),
  commissionRatesBps: z.array(z.number().int().min(0).max(10_000)).min(1).max(8).optional(),
  minStake: z.number().positive().optional(),
  maxStake: z.number().positive().optional(),
  minWithdrawal: z.number().positive().optional(),
  allowedPairs: z.array(z.string().min(3)).optional(),
});

export async function GET() {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, config: null });
  }

  const config = await getPlatformConfig();
  return NextResponse.json({ backend: true, config });
}

export async function PATCH(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let parsed;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  const adminId = await getAdminActorId(auth.session.address);
  const config = await updatePlatformConfig(parsed);

  if (adminId) {
    await prisma.adminAction.create({
      data: {
        adminId,
        action: "UPDATE_CONFIG",
        payload: parsed,
      },
    });
  }

  return NextResponse.json({ ok: true, config });
}
