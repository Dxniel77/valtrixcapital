import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { t } from "@/lib/i18n";
import {
  adjustUserBalance,
  getAdminActorId,
} from "@/lib/services/admin";
import {
  ProvisionUserException,
  adminProvisionUser,
} from "@/lib/services/users";

export const dynamic = "force-dynamic";

const withdrawalRuleSchema = z.object({
  mode: z.enum(["direct_sales", "network_levels", "either"]),
  directSalesMin: z.number().min(0),
  level1VolumeMin: z.number().min(0),
  level2VolumeMin: z.number().min(0),
});

const bodySchema = z.object({
  walletAddress: z.string().min(42).max(42),
  username: z.string().min(2).max(20).optional(),
  referrerWallet: z.string().nullable().optional(),
  withdrawalRule: withdrawalRuleSchema.optional(),
  initialActiveCapital: z.number().min(0).optional(),
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
    let user = await adminProvisionUser({
      walletAddress: parsed.walletAddress,
      username: parsed.username ?? null,
      referrerWallet: parsed.referrerWallet ?? null,
      withdrawalRule: parsed.withdrawalRule,
    });

    const capital = parsed.initialActiveCapital ?? 0;
    if (capital > 0) {
      const adminId = await getAdminActorId(auth.session.address);
      if (!adminId) {
        return NextResponse.json(
          { error: "Admin user record missing" },
          { status: 403 },
        );
      }
      user = await adjustUserBalance({
        adminUserId: adminId,
        targetUserId: user.id,
        delta: capital,
        note: "Initial active capital (granted account)",
        target: "STAKING",
      });
    }

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    if (err instanceof ProvisionUserException) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 },
      );
    }
    throw err;
  }
}
