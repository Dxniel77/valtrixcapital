import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { t } from "@/lib/i18n";
import {
  createTreasuryDeposit,
  TreasuryServiceError,
} from "@/lib/services/treasury";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  network: z.enum(["BSC", "POLYGON"]),
  pool: z.enum(["STAKING", "COPY"]).optional(),
  amount: z.number().positive(),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  requiredConfirmations: z.number().int().min(1).max(64),
  status: z.enum(["CONFIRMING", "CONFIRMED"]).optional(),
  confirmations: z.number().int().min(0).optional(),
}).superRefine((data, ctx) => {
  if (
    process.env.NODE_ENV === "production" &&
    (data.status === "CONFIRMED" ||
      (typeof data.confirmations === "number" &&
        data.confirmations >= data.requiredConfirmations))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Confirmation status is determined from chain data in production",
    });
  }
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
    const deposit = await createTreasuryDeposit({
      network: parsed.network,
      pool: parsed.pool,
      amount: parsed.amount,
      txHash: parsed.txHash,
      requiredConfirmations: parsed.requiredConfirmations,
      status: parsed.status,
      confirmations: parsed.confirmations,
      recordedBy: auth.session.address,
    });
    return NextResponse.json({ ok: true, deposit });
  } catch (err) {
    if (err instanceof TreasuryServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 },
      );
    }
    throw err;
  }
}
