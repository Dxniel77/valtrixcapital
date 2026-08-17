import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { adminCopyManualHistorySchema } from "@/lib/copy-trading/admin-schema";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  CopyTradingError,
  applyManualTraderHistory,
} from "@/lib/services/copy-trading";
import { findUserByWallet } from "@/lib/services/users";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  const admin = await findUserByWallet(auth.session.address);
  if (!admin) {
    return NextResponse.json({ error: "Admin user not found" }, { status: 403 });
  }
  const parsed = adminCopyManualHistorySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid manual result" }, { status: 400 });
  }
  try {
    const { id } = await params;
    const result = await applyManualTraderHistory({
      traderId: id,
      returnBps: parsed.data.returnBps,
      delayMinutes: parsed.data.delayMinutes ?? 0,
      adminUserId: admin.id,
    });
    return NextResponse.json({ ok: true, ...result });
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
