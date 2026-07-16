import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  confirmDeposit,
  listUserDeposits,
  registerDeposit,
  DepositServiceError,
} from "@/lib/services/deposits";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  network: z.enum(["BSC", "POLYGON"]),
  amount: z.number().positive(),
  fromAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  toAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  txHash: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

const confirmSchema = z.object({
  depositId: z.string().uuid(),
});

export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ backend: false, deposits: [] });
  }

  const deposits = await listUserDeposits(auth.session.dbUserId);
  return NextResponse.json({ backend: true, deposits });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const adminConfirm = url.searchParams.get("admin") === "confirm";

  if (adminConfirm) {
    const auth = await requireAdminSession();
    if (auth.error) return auth.error;
    if (!(await isDatabaseAvailable())) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    let parsed;
    try {
      parsed = confirmSchema.parse(await req.json());
    } catch {
      return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
    }

    try {
      const deposit = await confirmDeposit(parsed.depositId);
      return NextResponse.json({ ok: true, deposit });
    } catch (err) {
      if (err instanceof DepositServiceError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.code === "NOT_FOUND" ? 404 : 400 },
        );
      }
      throw err;
    }
  }

  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let parsed;
  try {
    parsed = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
  }

  try {
    const deposit = await registerDeposit({
      userId: auth.session.dbUserId,
      network: parsed.network,
      amount: parsed.amount,
      fromAddress: parsed.fromAddress,
      toAddress: parsed.toAddress,
      txHash: parsed.txHash,
    });
    return NextResponse.json({ ok: true, deposit });
  } catch (err) {
    if (err instanceof DepositServiceError) {
      const status =
        err.code === "DUPLICATE_TX"
          ? 409
          : err.code === "TX_REVERTED"
            ? 422
            : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
