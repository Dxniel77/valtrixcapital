import { NextResponse } from "next/server";
import { readSession, type SessionPayload } from "@/lib/auth/session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { findUserByWallet } from "@/lib/services/users";

export type SessionUser = SessionPayload & {
  dbUserId: string | null;
};

type SessionResult =
  | { session: SessionUser; error?: undefined }
  | { session?: undefined; error: NextResponse };

export async function requireSession(): Promise<SessionResult> {
  const session = await readSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  let dbUserId: string | null = null;
  if (await isDatabaseAvailable()) {
    const user = await findUserByWallet(session.address);
    dbUserId = user?.id ?? null;
  }

  return {
    session: { ...session, dbUserId },
  };
}
