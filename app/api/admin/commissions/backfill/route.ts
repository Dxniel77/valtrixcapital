import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { backfillMissedReferralCommissions } from "@/lib/services/commissions";
import { backfillMissedCopyPerformanceFeeNetwork } from "@/lib/copy-trading/distribute-performance-fee-network";
import { backfillReferralChains } from "@/lib/services/referral-chain";
import { repairRealStakeSources } from "@/lib/services/stake-repair";
import { backfillUnlockVolumes } from "@/lib/services/unlock-volume";

export const dynamic = "force-dynamic";

/** Replays upline commissions for past yield/trade credits that never paid out. */
export async function POST() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const [result, copyFeesBackfilled, chainsSynced, unlockVolumesSynced, stakesRepaired] =
    await Promise.all([
      backfillMissedReferralCommissions(),
      backfillMissedCopyPerformanceFeeNetwork(),
      backfillReferralChains(),
      backfillUnlockVolumes(),
      repairRealStakeSources(),
    ]);
  return NextResponse.json({
    ok: true,
    ...result,
    copyFeesBackfilled,
    chainsSynced,
    unlockVolumesSynced,
    stakesRepaired,
  });
}
