import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listCopyTraders } from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ backend: false, traders: [], page: 1, pageSize: 50, total: 0 });
  }

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "50");

  const result = await listCopyTraders({
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 50,
  });

  return NextResponse.json({ backend: true, ...result });
}
