import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getAdminActorId } from "@/lib/services/admin";
import { renewSponsorshipPeriod } from "@/lib/services/sponsorship-calendar";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  userId: z.string().uuid(),
  amountUsd: z.number().positive(),
  notes: z.string().max(500).optional(),
});

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
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  const period = await renewSponsorshipPeriod({
    adminId,
    userId: parsed.userId,
    amountUsd: parsed.amountUsd,
    notes: parsed.notes,
  });

  return NextResponse.json({ ok: true, period });
}
