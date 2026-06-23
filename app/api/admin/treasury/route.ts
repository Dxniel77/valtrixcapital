import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getTreasurySnapshot } from "@/lib/services/treasury";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, treasury: null });
  }

  const treasury = await getTreasurySnapshot();
  return NextResponse.json({ backend: true, treasury });
}
