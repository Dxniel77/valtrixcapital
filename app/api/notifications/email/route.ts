import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { t } from "@/lib/i18n";

const bodySchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  kind: z.enum(["alert", "promo", "system"]),
  dedupeKey: z.string().max(120).optional(),
  to: z.string().email().optional(),
});

const emailQueue: Array<{
  id: string;
  createdAt: number;
  subject: string;
  body: string;
  kind: string;
}> = [];

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`email:${ip}`, 20, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: t("api.rateLimited") }, { status: 429 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  const entry = {
    id: `eml_${Date.now().toString(36)}`,
    createdAt: Date.now(),
    subject: parsed.subject,
    body: parsed.body,
    kind: parsed.kind,
  };

  emailQueue.unshift(entry);
  if (emailQueue.length > 200) emailQueue.length = 200;

  if (process.env.RESEND_API_KEY && parsed.to) {
    // Production hook: wire Resend/SendGrid here when credentials are set.
    console.info("[email] queued for delivery", entry.id, parsed.to);
  } else if (process.env.NODE_ENV === "development") {
    console.info("[email:demo]", entry.subject, "—", entry.body);
  }

  return NextResponse.json({ ok: true, id: entry.id });
}
