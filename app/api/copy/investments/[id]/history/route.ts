import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  CopyTradingError,
  getCopyInvestmentHistory,
} from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ backend: false }, { status: 503 });
  }

  const { id } = await params;
  try {
    const history = await getCopyInvestmentHistory(auth.session.dbUserId, id);
    return NextResponse.json({ backend: true, ...history });
  } catch (err) {
    if (err instanceof CopyTradingError && err.code === "NOT_FOUND") {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
    }
    throw err;
  }
}
