import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/available";
import { readSession } from "@/lib/auth/session";
import { findUserByWallet } from "@/lib/services/users";
import {
  listCopyTraderCopiers,
  type CopierSortMode,
} from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const SORTS = new Set<CopierSortMode>([
  "pnl_desc",
  "pnl_asc",
  "roi_desc",
  "dur_desc",
]);

export async function GET(req: Request, { params }: Params) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({
      backend: false,
      total: 0,
      maxInvestors: 0,
      copiers: [],
    });
  }
  const { id } = await params;
  const sortRaw = new URL(req.url).searchParams.get("sort") ?? "pnl_desc";
  const sort = SORTS.has(sortRaw as CopierSortMode)
    ? (sortRaw as CopierSortMode)
    : "pnl_desc";

  const session = await readSession();
  let viewerUserId: string | null = null;
  if (session) {
    const user = await findUserByWallet(session.address);
    viewerUserId = user?.id ?? null;
  }

  const payload = await listCopyTraderCopiers(id, { sort, viewerUserId });
  if (!payload) {
    return NextResponse.json({
      backend: true,
      total: 0,
      maxInvestors: 0,
      copiers: [],
    });
  }
  return NextResponse.json({ backend: true, ...payload });
}
