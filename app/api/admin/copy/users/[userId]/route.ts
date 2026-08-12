import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listAdminUserCopyInvestments } from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { userId } = await params;
  return NextResponse.json({
    ok: true,
    ...(await listAdminUserCopyInvestments(userId)),
  });
}
