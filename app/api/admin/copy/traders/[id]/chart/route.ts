import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { adminCopyChartSchema } from "@/lib/copy-trading/admin-schema";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  CopyTradingError,
  deleteAdminChartPoint,
  upsertAdminChartPoint,
} from "@/lib/services/copy-trading";
import { findUserByWallet } from "@/lib/services/users";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function adminContext() {
  const auth = await requireAdminSession();
  if (auth.error) return { error: auth.error };
  if (!(await isDatabaseAvailable())) {
    return {
      error: NextResponse.json(
        { error: "Database unavailable" },
        { status: 503 },
      ),
    };
  }
  const admin = await findUserByWallet(auth.session.address);
  if (!admin) {
    return {
      error: NextResponse.json(
        { error: "Admin user not found" },
        { status: 403 },
      ),
    };
  }
  return { admin };
}

export async function PUT(req: Request, { params }: Params) {
  const ctx = await adminContext();
  if (ctx.error) return ctx.error;

  const parsed = adminCopyChartSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success || parsed.data.valueBps == null) {
    return NextResponse.json({ error: "Invalid history day" }, { status: 400 });
  }

  try {
    const { id } = await params;
    const point = await upsertAdminChartPoint(
      id,
      parsed.data.date,
      parsed.data.valueBps,
      ctx.admin.id,
    );
    return NextResponse.json({ ok: true, point });
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

export async function DELETE(req: Request, { params }: Params) {
  const ctx = await adminContext();
  if (ctx.error) return ctx.error;

  const parsed = adminCopyChartSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid history day" }, { status: 400 });
  }

  try {
    const { id } = await params;
    await deleteAdminChartPoint(id, parsed.data.date, ctx.admin.id);
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
