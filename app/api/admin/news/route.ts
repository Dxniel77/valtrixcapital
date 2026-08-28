import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { t } from "@/lib/i18n";
import { newsWriteSchema } from "@/lib/news/schema";
import {
  createNewsPost,
  listAdminNews,
  NewsError,
  NewsImageError,
} from "@/lib/services/news";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, posts: [] });
  }

  const posts = await listAdminNews();
  return NextResponse.json({ backend: true, posts });
}

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: t("api.backendUnavailable") }, { status: 503 });
  }

  let parsed;
  try {
    parsed = newsWriteSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: t("api.validationFailed"), details: err.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const post = await createNewsPost(parsed, auth.session.address);
    return NextResponse.json({ ok: true, post });
  } catch (err) {
    if (err instanceof NewsImageError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (err instanceof NewsError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    throw err;
  }
}
