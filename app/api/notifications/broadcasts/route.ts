import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import {
  listBroadcasts,
  publishPlatformBroadcast,
} from "@/lib/notifications/broadcast-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const broadcastSchema = z.object({
  kind: z.enum(["alert", "promo", "system"]),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
  href: z.string().trim().max(200).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw ? Number(sinceRaw) : 0;
  const broadcasts = await listBroadcasts(
    Number.isFinite(since) && since > 0 ? since : 0,
  );
  return NextResponse.json({ broadcasts });
}

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  let parsed;
  try {
    parsed = broadcastSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: t("api.validationFailed"), details: err.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  const broadcast = await publishPlatformBroadcast({
    kind: parsed.kind,
    title: parsed.title,
    body: parsed.body,
    href: parsed.href || undefined,
    createdBy: auth.session.address,
  });

  return NextResponse.json({ ok: true, broadcast });
}
