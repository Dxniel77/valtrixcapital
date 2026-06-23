import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listInboxNotificationsForSession } from "@/lib/services/inbox-notifications";
import { findUserByWallet } from "@/lib/services/users";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, notifications: [] });
  }

  const url = new URL(req.url);
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw ? Number(sinceRaw) : 0;

  let dbUserId: string | null = null;
  const user = await findUserByWallet(session.address);
  dbUserId = user?.id ?? null;

  const notifications = await listInboxNotificationsForSession({
    role: session.role,
    address: session.address,
    dbUserId,
    since: Number.isFinite(since) && since > 0 ? since : 0,
  });

  return NextResponse.json({ backend: true, notifications });
}
