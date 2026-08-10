import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getAdminActorId } from "@/lib/services/admin";
import { adminUpdateUserProfile } from "@/lib/services/account-management";
import { AccountManagementError } from "@/lib/services/account-management";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  username: z.string().trim().min(2).max(32).optional(),
  email: z.string().email().nullable().optional(),
  avatarUrl: z.union([z.string().max(500), z.null()]).optional(),
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
    await adminUpdateUserProfile({
      adminId,
      userId: id,
      username: parsed.username,
      email: parsed.email,
      avatarUrl: parsed.avatarUrl,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AccountManagementError) {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
    throw err;
  }
}
