import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  applyReferrerIfMissing,
  findUserByWalletWithReferrer,
  serializeUserWithReferrer,
  serializeUserWithReferrerAsync,
  updateUsername,
  upsertUserByWallet,
} from "@/lib/services/users";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  username: z.string().trim().min(2).max(32).optional(),
  referralCode: z.string().trim().max(32).optional(),
});

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, user: null });
  }

  let user = auth.session.dbUserId
    ? await findUserByWalletWithReferrer(auth.session.address)
    : null;

  if (!user) {
    const created = await upsertUserByWallet(auth.session.address);
    user = await findUserByWalletWithReferrer(created.walletAddress);
  }

  if (!user) {
    return NextResponse.json({ backend: true, user: null });
  }

  return NextResponse.json({
    backend: true,
    user: await serializeUserWithReferrerAsync(user),
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

  if (!parsed.username && !parsed.referralCode) {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  let dbUserId = auth.session.dbUserId;
  if (!dbUserId) {
    const created = await upsertUserByWallet(auth.session.address, {
      referrerCode: parsed.referralCode ?? null,
    });
    dbUserId = created.id;
  } else if (parsed.referralCode) {
    await applyReferrerIfMissing(dbUserId, parsed.referralCode);
  }

  if (parsed.username) {
    await updateUsername(dbUserId, parsed.username);
  }

  const withReferrer = await findUserByWalletWithReferrer(auth.session.address);
  if (!withReferrer) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: await serializeUserWithReferrerAsync(withReferrer),
  });
}
