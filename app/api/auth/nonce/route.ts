import { NextResponse } from "next/server";
import { createStoredNonce } from "@/lib/auth/nonce-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const { nonce, expiresAt } = await createStoredNonce();
  return NextResponse.json({ nonce, expiresAt: expiresAt.toISOString() });
}
