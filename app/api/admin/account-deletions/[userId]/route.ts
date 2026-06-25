import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getAdminActorId } from "@/lib/services/admin";
import {
  AccountManagementError,
  adminProcessDeletionRequest,
} from "@/lib/services/account-management";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z.enum(["approve", "cancel"]),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ userId: string }> },
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

  const { userId } = await ctx.params;

  let parsed;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const request = await adminProcessDeletionRequest({
      adminId,
      userId,
      action: parsed.action,
    });
    return NextResponse.json({ ok: true, request });
  } catch (err) {
    if (err instanceof AccountManagementError) {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
    throw err;
  }
}
