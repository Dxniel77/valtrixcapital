import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { CopyTradingError, decideCopyWithdrawal } from "@/lib/services/copy-trading";
import { findUserByWallet } from "@/lib/services/users";

export const dynamic = "force-dynamic";

const schema = z.object({ decision: z.enum(["APPROVE", "REJECT"]) });
type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid withdrawal decision" }, { status: 400 });
  }
  const admin = await findUserByWallet(auth.session.address);
  if (!admin) return NextResponse.json({ error: "Admin user not found" }, { status: 403 });

  try {
    const { id } = await params;
    await decideCopyWithdrawal({
      withdrawalId: id,
      decision: parsed.data.decision,
      adminUserId: admin.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CopyTradingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "NOT_FOUND" ? 404 : 400 },
      );
    }
    throw error;
  }
}
