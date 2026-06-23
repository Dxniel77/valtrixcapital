import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { userReplyToSupportTicket } from "@/lib/services/support-tickets";
import { MAX_SUPPORT_ATTACHMENTS_PER_MESSAGE } from "@/lib/support/constants";

export const dynamic = "force-dynamic";

function filesFromForm(form: FormData): File[] {
  const files = form
    .getAll("files")
    .filter((item): item is File => item instanceof File && item.size > 0);
  return files.slice(0, MAX_SUPPORT_ATTACHMENTS_PER_MESSAGE);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let message = "";
  let files: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    message = String(form.get("message") ?? "").trim();
    files = filesFromForm(form);
  } else {
    try {
      const body = (await req.json()) as { message?: string };
      message = String(body.message ?? "").trim();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
  }

  if (message.length < 2 && files.length === 0) {
    return NextResponse.json({ error: "Message or attachment required" }, { status: 400 });
  }

  const ticket = await userReplyToSupportTicket({
    ticketId: id,
    session: auth.session,
    body: message,
    files,
  });

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ticket });
}
