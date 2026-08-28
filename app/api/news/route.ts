import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listPublishedNews } from "@/lib/services/news";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, posts: [] });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const posts = await listPublishedNews(Number.isFinite(limit) ? limit : 50);
  return NextResponse.json({ backend: true, posts });
}
