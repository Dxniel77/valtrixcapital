import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { adminCopyOperationSchema } from "@/lib/copy-trading/admin-schema";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  CopyTradingError,
  deleteAdminCopyOperation,
  updateAdminCopyOperation,
} from "@/lib/services/copy-trading";
import { findUserByWallet } from "@/lib/services/users";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ opId: string }> };

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

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await adminContext();
  if (ctx.error) return ctx.error;

  const parsed = adminCopyOperationSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
  }

  try {
    const { opId } = await params;
    const operation = await updateAdminCopyOperation(
      opId,
      parsed.data,
      ctx.admin.id,
    );
    return NextResponse.json({ ok: true, operation });
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

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await adminContext();
  if (ctx.error) return ctx.error;

  try {
    const { opId } = await params;
    await deleteAdminCopyOperation(opId, ctx.admin.id);
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
