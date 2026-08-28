import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getNewsImage } from "@/lib/services/news";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isDatabaseAvailable())) {
    return new NextResponse(null, { status: 503 });
  }

  const { id } = await ctx.params;
  const session = await readSession();
  const allowUnpublished = session?.role === "ADMIN";
  const image = await getNewsImage(id, { allowUnpublished });
  if (!image) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.data), {
    status: 200,
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      ETag: `"${image.updatedAt.getTime()}"`,
    },
  });
}
