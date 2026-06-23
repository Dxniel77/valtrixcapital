"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  setPendingReferralCode,
  clearPendingReferralCode,
} from "@/lib/referrals/pending-sponsor";
import { validateReferralCode } from "@/lib/referrals/validate-client";

/** Persists ?ref= from any entry URL until the user registers. */
export function ReferralCapture() {
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;

    void validateReferralCode(ref).then((status) => {
      if (status.eligible) {
        setPendingReferralCode(ref);
      } else {
        clearPendingReferralCode();
      }
    });
  }, [searchParams]);

  return null;
}
