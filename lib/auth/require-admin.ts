import { NextResponse } from "next/server";
import { readSession, type SessionPayload } from "@/lib/auth/session";

type AdminResult =
  | { session: SessionPayload; error?: undefined }
  | { session?: undefined; error: NextResponse };

export async function requireAdminSession(): Promise<AdminResult> {
  const session = await readSession();
  if (!session || session.role !== "ADMIN") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session };
}
