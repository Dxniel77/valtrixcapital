import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import {
  createWithdrawal,
  listPendingWithdrawals,
  listUserWithdrawals,
  updateWithdrawalStatus,
  WithdrawalServiceError,
} from "@/lib/services/withdrawals";
import { getAdminActorId } from "@/lib/services/admin";
import { getPlatformConfig as readConfig } from "@/lib/services/config";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  network: z.enum(["BSC", "POLYGON"]),
  amount: z.number().positive(),
  toAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

const adminPatchSchema = z.object({
  withdrawalId: z.string().uuid(),
  status: z.enum(["APPROVED", "REJECTED", "SENT", "CONFIRMED"]),
  txHash: z.string().regex(/^0x[0-9a-fA-F]+$/).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");

  if (scope === "pending") {
    const auth = await requireAdminSession();
    if (auth.error) return auth.error;
    if (!(await isDatabaseAvailable())) {
      return NextResponse.json({ backend: false, withdrawals: [] });
    }
    const withdrawals = await listPendingWithdrawals();
    return NextResponse.json({ backend: true, withdrawals });
  }

  const auth = await requireSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable()) || !auth.session.dbUserId) {
    return NextResponse.json({ backend: false, withdrawals: [] });
  }

  const withdrawals = await listUserWithdrawals(auth.session.dbUserId);
  return NextResponse.json({ backend: true, withdrawals });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const adminAction = url.searchParams.get("admin");

  if (adminAction === "retry-payout") {
    const auth = await requireAdminSession();
    if (auth.error) return auth.error;
    if (!(await isDatabaseAvailable())) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    let body: { withdrawalId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
    }
    if (!body.withdrawalId) {
      return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
    }

    try {
      const { processAutomaticWithdrawalPayout } = await import(
        "@/lib/services/withdrawal-payout"
      );
      const { txHash } = await processAutomaticWithdrawalPayout(body.withdrawalId);
      return NextResponse.json({ ok: true, txHash });
    } catch (err) {
      if (err instanceof WithdrawalServiceError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.code === "PAYOUT_FAILED" ? 502 : 400 },
        );
      }
      throw err;
    }
  }

  if (adminAction === "status") {
    const auth = await requireAdminSession();
    if (auth.error) return auth.error;
    if (!(await isDatabaseAvailable())) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const adminId = await getAdminActorId(auth.session.address);
    if (!adminId) {
      return NextResponse.json({ error: "Admin user record missing" }, { status: 403 });
    }

    let parsed;
    try {
      parsed = adminPatchSchema.parse(await req.json());
    } catch {
      return NextResponse.json({ error: t("api.invalidBody") }, { status: 400 });
    }

    try {
      const withdrawal = await updateWithdrawalStatus({
        adminUserId: adminId,
        withdrawalId: parsed.withdrawalId,
        status: parsed.status,
        txHash: parsed.txHash,
      });
      return NextResponse.json({ ok: true, withdrawal });
    } catch (err) {
      if (err instanceof WithdrawalServiceError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          {
            status:
              err.code === "NOT_FOUND"
                ? 404
                : err.code === "INSUFFICIENT_TREASURY"
                  ? 409
                  : 400,
          },
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

  const config = await readConfig();

  if (parsed.amount < config.minWithdrawal) {
    return NextResponse.json(
      {
        error: `Minimum withdrawal is ${config.minWithdrawal} USDT`,
        code: "BELOW_MINIMUM",
      },
      { status: 400 },
    );
  }

  try {
    const withdrawal = await createWithdrawal({
      userId: auth.session.dbUserId,
      network: parsed.network,
      amount: parsed.amount,
      feeBps: config.withdrawalFeeBps,
      toAddress: parsed.toAddress,
    });
    return NextResponse.json({ ok: true, withdrawal });
  } catch (err) {
      if (err instanceof WithdrawalServiceError) {
        const status =
          err.code === "INSUFFICIENT_BALANCE"
            ? 409
            : err.code === "INSUFFICIENT_TREASURY"
              ? 409
              : err.code === "PAYOUT_FAILED"
                ? 502
              : err.code === "INACTIVE"
                ? 403
                : err.code === "WITHDRAWAL_LOCKED"
                  ? 403
                : 400;
        return NextResponse.json({ error: err.message, code: err.code }, { status });
      }
    throw err;
  }
}
