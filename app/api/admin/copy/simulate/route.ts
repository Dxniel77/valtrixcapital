import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { CopyTradingError, runCopyTradingSimulation } from "@/lib/services/copy-trading";
import { findUserByWallet } from "@/lib/services/users";

export const dynamic = "force-dynamic";

const schema = z.object({
  traderId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid simulation request" }, { status: 400 });
  }
  const admin = await findUserByWallet(auth.session.address);
  if (!admin) return NextResponse.json({ error: "Admin user not found" }, { status: 403 });

  try {
    const result = await runCopyTradingSimulation({
      traderId: parsed.data.traderId,
      force: true,
      adminUserId: admin.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CopyTradingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
}
