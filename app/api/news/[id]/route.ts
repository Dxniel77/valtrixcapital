import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getPublishedNewsPost } from "@/lib/services/news";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, post: null }, { status: 503 });
  }

  const { id } = await ctx.params;
  const post = await getPublishedNewsPost(id);
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ backend: true, post });
}
