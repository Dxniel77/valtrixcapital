import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseAvailable } from "@/lib/db/available";

export const dynamic = "force-dynamic";

/** GET — public IB avatar bytes from Neon. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  if (!(await isDatabaseAvailable())) {
    return new NextResponse(null, { status: 503 });
  }

  const { userId } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      avatarBytes: true,
      avatarMime: true,
      updatedAt: true,
      ibAgreement: { select: { isIb: true } },
    },
  });

  if (
    !user ||
    user.ibAgreement?.isIb !== true ||
    !user.avatarBytes ||
    !user.avatarMime
  ) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(user.avatarBytes), {
    status: 200,
    headers: {
      "Content-Type": user.avatarMime,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      ETag: `"${user.updatedAt.getTime()}"`,
    },
  });
}
