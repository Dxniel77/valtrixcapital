import { NextResponse } from "next/server";
import { isDatabaseAvailable, isDatabaseConfigured } from "@/lib/db/available";
import {
  getProductionConfigIssues,
  isProductionReady,
} from "@/lib/config/production-env";
import { isProductionRuntime } from "@/lib/runtime-mode";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isDatabaseConfigured();
  const database = configured ? await isDatabaseAvailable() : false;
  const production = isProductionRuntime();
  const configIssues = production ? getProductionConfigIssues() : [];

  return NextResponse.json({
    ok: production ? isProductionReady() && database : true,
    database,
    production,
    productionReady: production ? isProductionReady() : null,
    configIssues: configIssues.map(({ key, severity, message }) => ({
      key,
      severity,
      message,
    })),
    version: process.env.npm_package_version ?? "0.1.0",
  });
}
