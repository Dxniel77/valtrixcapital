import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { adminCopyBulkPerformanceSchema } from "@/lib/copy-trading/admin-schema";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  CopyTradingError,
  previewManyTraderPerformance,
} from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const parsed = adminCopyBulkPerformanceSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preview" }, { status: 400 });
  }

  try {
    const result = await previewManyTraderPerformance(parsed.data.items);
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
