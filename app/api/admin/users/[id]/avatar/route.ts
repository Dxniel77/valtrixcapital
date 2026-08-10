import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getAdminActorId } from "@/lib/services/admin";
import {
  clearUserAvatar,
  findUserById,
  serializeUser,
  setUserAvatarImage,
} from "@/lib/services/users";
import { AvatarUrlError } from "@/lib/user/avatar";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  dataBase64: z.string().min(32).max(400_000),
  mime: z.string().max(64).optional(),
});

/** POST — admin uploads IB avatar into Neon. */
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
    await setUserAvatarImage(id, {
      dataBase64: parsed.dataBase64,
      mime: parsed.mime,
    });
  } catch (err) {
    if (err instanceof AvatarUrlError) {
      const status =
        err.code === "NOT_IB" ? 403 : err.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    throw err;
  }

  await prisma.adminAction.create({
    data: {
      adminId,
      targetUserId: id,
      action: "UPDATE_USER_PROFILE",
      payload: { avatarUploaded: true },
    },
  });

  const user = await findUserById(id);
  return NextResponse.json({
    ok: true,
    user: user ? serializeUser(user) : null,
  });
}

/** DELETE — admin clears IB avatar. */
export async function DELETE(
  _req: Request,
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
  try {
    await clearUserAvatar(id);
  } catch (err) {
    if (err instanceof AvatarUrlError) {
      const status =
        err.code === "NOT_IB" ? 403 : err.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    throw err;
  }

  await prisma.adminAction.create({
    data: {
      adminId,
      targetUserId: id,
      action: "UPDATE_USER_PROFILE",
      payload: { avatarUrl: null },
    },
  });

  const user = await findUserById(id);
  return NextResponse.json({
    ok: true,
    user: user ? serializeUser(user) : null,
  });
}
