import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: session.sub, address: session.address, role: session.role },
  });
}
