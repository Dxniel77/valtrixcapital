"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { setPendingReferralCode } from "@/lib/referrals/pending-sponsor";

/** Persists ?ref= from any entry URL until the user registers. */
export function ReferralCapture() {
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setPendingReferralCode(ref);
  }, [searchParams]);

  return null;
}
