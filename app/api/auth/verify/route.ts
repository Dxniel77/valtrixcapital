import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeNonce, verifySiwe } from "@/lib/auth/siwe";
import { normalizeWallet } from "@/lib/auth/admins";
import { resolveUserRole } from "@/lib/auth/resolve-role";
import { createSession } from "@/lib/auth/session";
import { randomBytes } from "crypto";
import { t } from "@/lib/i18n";

const bodySchema = z.object({
  message: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  nonce: z.string().min(8),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: t("api.invalidBody") },
      { status: 400 },
    );
  }

  const ok = consumeNonce(parsed.nonce);
  if (!ok) {
    return NextResponse.json(
      { error: t("api.invalidNonce") },
      { status: 401 },
    );
  }

  const result = await verifySiwe({
    message: parsed.message,
    signature: parsed.signature,
    expectedNonce: parsed.nonce,
  });
  if (!result) {
    return NextResponse.json({ error: t("api.verifyFailed") }, { status: 401 });
  }

  // Week 1: skip DB write — issue a session keyed by wallet address.
  // Week 5+: upsert User in Prisma here and use real userId as sub.
  const address = normalizeWallet(result.address);
  const role = await resolveUserRole(address);
  const userId = `wallet:${address}:${randomBytes(4).toString("hex")}`;

  await createSession({
    sub: userId,
    address,
    role,
  });

  return NextResponse.json({
    ok: true,
    user: { id: userId, address, role },
  });
}
