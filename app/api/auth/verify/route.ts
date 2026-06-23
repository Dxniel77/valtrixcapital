import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeStoredNonce } from "@/lib/auth/nonce-store";
import { verifySiwe } from "@/lib/auth/siwe";
import { normalizeWallet } from "@/lib/auth/admins";
import { resolveUserRole } from "@/lib/auth/resolve-role";
import { createSession } from "@/lib/auth/session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { applyReferrerIfMissing, upsertUserByWallet } from "@/lib/services/users";
import { fromMicro } from "@/lib/utils";
import { t } from "@/lib/i18n";

const bodySchema = z.object({
  message: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  nonce: z.string().min(8),
  referralCode: z.string().trim().max(32).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  const ok = await consumeStoredNonce(parsed.nonce);
  if (!ok) {
    return NextResponse.json({ error: t("api.invalidNonce") }, { status: 401 });
  }

  const result = await verifySiwe({
    message: parsed.message,
    signature: parsed.signature,
    expectedNonce: parsed.nonce,
  });
  if (!result) {
    return NextResponse.json({ error: t("api.verifyFailed") }, { status: 401 });
  }

  const address = normalizeWallet(result.address);
  const role = await resolveUserRole(address);

  let userId = `wallet:${address}`;
  let dbUser: Awaited<ReturnType<typeof upsertUserByWallet>> | null = null;

  if (await isDatabaseAvailable()) {
    dbUser = await upsertUserByWallet(address, {
      referrerCode: parsed.referralCode ?? null,
    });
    if (dbUser && parsed.referralCode) {
      const linked = await applyReferrerIfMissing(dbUser.id, parsed.referralCode);
      if (linked) dbUser = linked;
    }
    userId = dbUser.id;
  }

  await createSession({
    sub: userId,
    address,
    role,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: userId,
      address,
      role,
      db: dbUser
        ? {
            referralCode: dbUser.referralCode,
            earningsBalance: fromMicro(dbUser.earningsBalance),
          }
        : null,
    },
  });
}
