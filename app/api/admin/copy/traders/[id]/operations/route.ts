import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { adminCopyOperationSchema } from "@/lib/copy-trading/admin-schema";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  CopyTradingError,
  createAdminCopyOperation,
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

  const parsed = adminCopyOperationSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") || "operation";
    return NextResponse.json(
      { error: issue ? `${path}: ${issue.message}` : "Invalid operation" },
      { status: 400 },
    );
  }

  const admin = await findUserByWallet(auth.session.address);
  if (!admin) {
    return NextResponse.json({ error: "Admin user not found" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const operation = await createAdminCopyOperation(id, parsed.data, admin.id);
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
