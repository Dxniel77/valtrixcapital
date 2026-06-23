import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/available";
import { validateReferralCode } from "@/lib/services/referral-code";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code?.trim()) {
    return NextResponse.json({ eligible: false, reason: "not_found" });
  }

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ eligible: true });
  }

  const status = await validateReferralCode(code);
  return NextResponse.json(status);
}
