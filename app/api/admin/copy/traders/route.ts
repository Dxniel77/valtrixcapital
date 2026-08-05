import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { adminCopyTraderSchema } from "@/lib/copy-trading/admin-schema";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  CopyTradingError,
  createAdminCopyTrader,
  listAdminCopyTraders,
} from "@/lib/services/copy-trading";
import { findUserByWallet } from "@/lib/services/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, traders: await listAdminCopyTraders() });
}

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const parsed = adminCopyTraderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid trader data" }, { status: 400 });
  }
  const admin = await findUserByWallet(auth.session.address);
  if (!admin) return NextResponse.json({ error: "Admin user not found" }, { status: 403 });

  try {
    const trader = await createAdminCopyTrader(parsed.data, admin.id);
    return NextResponse.json({ ok: true, trader }, { status: 201 });
  } catch (error) {
    if (error instanceof CopyTradingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
}
