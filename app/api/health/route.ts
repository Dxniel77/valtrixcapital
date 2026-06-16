import { NextResponse } from "next/server";
import { isDatabaseAvailable, isDatabaseConfigured } from "@/lib/db/available";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isDatabaseConfigured();
  const database = configured ? await isDatabaseAvailable() : false;

  return NextResponse.json({
    ok: true,
    database,
    version: process.env.npm_package_version ?? "0.1.0",
  });
}
