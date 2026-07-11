import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { registerDeviceToken } from "@/lib/services/copy-trading";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]).or(z.string().min(1)),
});

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let parsed;
  try {
    parsed = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  await registerDeviceToken({
    userId: auth.session.dbUserId,
    token: parsed.token,
    platform: parsed.platform,
  });

  return NextResponse.json({ ok: true });
}
