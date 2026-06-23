import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { requireSession } from "@/lib/auth/require-session";
import { getSupportAttachmentForDownload } from "@/lib/services/support-attachments";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const adminAuth = await requireAdminSession();
  if (!adminAuth.error) {
    const file = await getSupportAttachmentForDownload(
      id,
      { ...adminAuth.session, dbUserId: null },
      true,
    );
    if (!file) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const userAuth = await requireSession();
  if (userAuth.error) return userAuth.error;

  const file = await getSupportAttachmentForDownload(
    id,
    userAuth.session,
    false,
  );
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
