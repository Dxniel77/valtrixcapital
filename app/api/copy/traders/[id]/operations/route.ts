import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/available";
import { readSession } from "@/lib/auth/session";
import { findUserByWallet } from "@/lib/services/users";
import { getCopyTraderOperations } from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({
      backend: false,
      locked: true,
      current: null,
      history: [],
    });
  }
  const { id } = await params;
  const session = await readSession();
  let viewerUserId: string | null = null;
  if (session) {
    const user = await findUserByWallet(session.address);
    viewerUserId = user?.id ?? null;
  }
  return NextResponse.json({
    backend: true,
    ...(await getCopyTraderOperations(id, viewerUserId)),
  });
}
