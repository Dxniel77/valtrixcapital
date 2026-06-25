import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

/** Account deletion is managed by administrators only. */
export async function GET() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function DELETE() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
