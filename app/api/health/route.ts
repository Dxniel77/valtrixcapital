import { NextResponse } from "next/server";
import { isDatabaseAvailable, isDatabaseConfigured } from "@/lib/db/available";
import { readServerSecret } from "@/lib/config/server-env";
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
  const copyPayoutConfigured = Boolean(
    readServerSecret(
      "COPY_PAYOUT_PRIVATE_KEY",
      "COPY_BSC_PAYOUT_PRIVATE_KEY",
      "COPY_POLYGON_PAYOUT_PRIVATE_KEY",
    ),
  );

  return NextResponse.json({
    ok: production ? isProductionReady() && database : true,
    database,
    production,
    productionReady: production ? isProductionReady() : null,
    copyPayoutConfigured,
    envPresent: {
      TREASURY_PAYOUT_PRIVATE_KEY: Boolean(
        readServerSecret(
          "TREASURY_PAYOUT_PRIVATE_KEY",
          "TREASURY_BSC_PAYOUT_PRIVATE_KEY",
          "TREASURY_POLYGON_PAYOUT_PRIVATE_KEY",
        ),
      ),
      COPY_PAYOUT_PRIVATE_KEY: copyPayoutConfigured,
      NEXT_PUBLIC_COPY_BSC_ADDRESS: Boolean(
        readServerSecret("NEXT_PUBLIC_COPY_BSC_ADDRESS"),
      ),
      NEXT_PUBLIC_COPY_POLYGON_ADDRESS: Boolean(
        readServerSecret("NEXT_PUBLIC_COPY_POLYGON_ADDRESS"),
      ),
    },
    configIssues: configIssues.map(({ key, severity, message }) => ({
      key,
      severity,
      message,
    })),
    version: process.env.npm_package_version ?? "0.1.0",
  });
}
