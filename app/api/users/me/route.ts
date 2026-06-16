import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  findUserByWallet,
  serializeUser,
  updateUsername,
  upsertUserByWallet,
} from "@/lib/services/users";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  username: z.string().trim().min(2).max(32).optional(),
});

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, user: null });
  }

  let user = auth.session.dbUserId
    ? await findUserByWallet(auth.session.address)
    : null;

  if (!user) {
    user = await upsertUserByWallet(auth.session.address);
  }

  return NextResponse.json({
    backend: true,
    user: serializeUser(user),
  });
}

export async function PATCH(req: Request) {
  const auth = await requireSession();
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

  if (!auth.session.dbUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (parsed.username) {
    const user = await updateUsername(auth.session.dbUserId, parsed.username);
    return NextResponse.json({ user: serializeUser(user) });
  }

  return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
}
