import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  confirmDepositForUser,
  DepositServiceError,
} from "@/lib/services/deposits";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { id } = await ctx.params;

  try {
    const deposit = await confirmDepositForUser(id, auth.session.dbUserId);
    return NextResponse.json({ ok: true, deposit });
  } catch (err) {
    if (err instanceof DepositServiceError) {
      const status =
        err.code === "NOT_FOUND"
          ? 404
          : err.code === "NOT_READY"
            ? 409
            : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    throw err;
  }
}
