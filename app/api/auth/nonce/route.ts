import { NextResponse } from "next/server";
import { createNonce } from "@/lib/auth/siwe";

export const dynamic = "force-dynamic";

export async function GET() {
  const { nonce, expiresAt } = createNonce();
  return NextResponse.json({ nonce, expiresAt: expiresAt.toISOString() });
}
