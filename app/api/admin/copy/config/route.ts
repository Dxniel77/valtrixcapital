import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  CopyTradingError,
  updateCopyTradingConfig,
} from "@/lib/services/copy-trading";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  investFeeBps: z.number().int().min(0).max(2000).optional(),
  withdrawFeeBps: z.number().int().min(0).max(2000).optional(),
  copyCashWalletFeeBps: z.number().int().min(0).max(2000).optional(),
  withdrawalMode: z.enum(["INSTANT", "APPROVAL"]).optional(),
  globalMinInvestment: z.number().finite().min(0).optional(),
  performanceFeeNetworkBps: z
    .array(z.number().int().min(0).max(10_000))
    .length(6)
    .optional(),
  openFeeBps: z.number().int().min(0).max(2000).optional(),
  activeSymbols: z.array(z.string().trim().min(2).max(20)).min(1).max(20).optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid config" }, { status: 400 });
  }

  try {
    const config = await updateCopyTradingConfig(parsed.data);
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    if (error instanceof CopyTradingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }
    throw error;
  }
}
