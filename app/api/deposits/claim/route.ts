import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { normalizeWallet } from "@/lib/auth/admins";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  claimDepositFromTx,
  DepositServiceError,
} from "@/lib/services/deposits";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const claimSchema = z.object({
  network: z.enum(["BSC", "POLYGON"]),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  purpose: z.enum(["STAKING", "COPY"]).optional(),
});

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let parsed;
  try {
    parsed = claimSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const deposit = await claimDepositFromTx({
      userId: auth.session.dbUserId,
      walletAddress: normalizeWallet(auth.session.address),
      network: parsed.network,
      txHash: parsed.txHash,
      purpose: parsed.purpose,
    });
    return NextResponse.json({ ok: true, deposit });
  } catch (err) {
    if (err instanceof DepositServiceError) {
      const status =
        err.code === "NOT_FOUND" || err.code === "TX_NOT_VERIFIED"
          ? 404
          : err.code === "TX_OWNED_BY_OTHER"
            ? 409
            : err.code === "DUPLICATE_TX"
              ? 409
              : err.code === "TX_REVERTED"
                ? 422
                : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    throw err;
  }
}
