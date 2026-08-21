import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { listBscHotWalletUsdtOutflows } from "@/lib/services/hot-wallet-outflows";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({
      backend: false,
      items: [],
      wallets: [],
      usdtContract: "",
      explorerConfigured: false,
      minUsd: 1,
    });
  }

  const result = await listBscHotWalletUsdtOutflows();
  return NextResponse.json({ backend: true, ...result });
}
