import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { t } from "@/lib/i18n";
import {
  ReferrerUpdateException,
  adminSetUserReferrer,
} from "@/lib/services/users";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  referrerQuery: z.string().nullable(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { id } = await ctx.params;

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const user = await adminSetUserReferrer(id, parsed.referrerQuery);
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    if (err instanceof ReferrerUpdateException) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === "NOT_FOUND" ? 404 : 400 },
      );
    }
    throw err;
  }
}
