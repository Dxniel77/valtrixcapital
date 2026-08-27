import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { t } from "@/lib/i18n";
import {
  recordTreasuryWithdrawal,
  TreasuryServiceError,
} from "@/lib/services/treasury";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  network: z.enum(["BSC", "POLYGON"]),
  pool: z.enum(["STAKING", "COPY"]).optional(),
  amount: z.number().positive(),
  toAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  txHash: z.string().regex(/^0x[0-9a-fA-F]+$/).optional(),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const withdrawal = await recordTreasuryWithdrawal({
      network: parsed.network,
      pool: parsed.pool,
      amount: parsed.amount,
      toAddress: parsed.toAddress,
      txHash: parsed.txHash,
      note: parsed.note,
      createdBy: auth.session.address,
    });
    return NextResponse.json({ ok: true, withdrawal });
  } catch (err) {
    if (err instanceof TreasuryServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === "INSUFFICIENT_FUNDS" ? 409 : 400 },
      );
    }
    throw err;
  }
}
