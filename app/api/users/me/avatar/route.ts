import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  clearUserAvatar,
  findUserByWalletWithReferrer,
  serializeUserWithReferrerAsync,
  setUserAvatarImage,
} from "@/lib/services/users";
import { AvatarUrlError } from "@/lib/user/avatar";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** data:image/jpeg;base64,... or raw base64 */
  dataBase64: z.string().min(32).max(400_000),
  mime: z.string().max(64).optional(),
});

/** POST — IB uploads compressed avatar (stored in Neon). */
export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    await setUserAvatarImage(auth.session.dbUserId, {
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

  const withReferrer = await findUserByWalletWithReferrer(auth.session.address);
  return NextResponse.json({
    backend: true,
    user: withReferrer
      ? await serializeUserWithReferrerAsync(withReferrer)
      : null,
  });
}

/** DELETE — clear IB avatar. */
export async function DELETE() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    await clearUserAvatar(auth.session.dbUserId);
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

  const withReferrer = await findUserByWalletWithReferrer(auth.session.address);
  return NextResponse.json({
    backend: true,
    user: withReferrer
      ? await serializeUserWithReferrerAsync(withReferrer)
      : null,
  });
}
