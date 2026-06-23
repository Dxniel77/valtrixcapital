"use client";

import * as React from "react";
import { fetchCurrentUser } from "@/lib/api/client";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { allowOfflineSimulation } from "@/lib/runtime-mode";
import { isReferralLinkEligible } from "@/lib/referrals/link-eligibility";
import { referralLink } from "@/lib/referrals/store";
import { useStakingStore } from "@/lib/staking/store";
import { selectActiveCapital } from "@/lib/staking/selectors";

function codeFromWallet(addr: string): string {
  const clean = addr.replace(/^0x/i, "").toUpperCase();
  return `VX${clean.slice(-6)}`;
}

export interface ReferralInviteState {
  loading: boolean;
  eligible: boolean;
  code: string | null;
  link: string;
}

/** Whether the signed-in user may share a referral link (active account + ≥ $15 capital). */
export function useReferralInvite(
  walletAddress?: string,
): ReferralInviteState {
  const backend = useBackendAvailable();
  const offlineDemo = allowOfflineSimulation();
  const activeCapital = useStakingStore((s) => selectActiveCapital(s.stakes));
  const [loading, setLoading] = React.useState(backend);
  const [eligible, setEligible] = React.useState(false);
  const [code, setCode] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      setEligible(false);
      setCode(null);
      return;
    }

    if (!backend) {
      setLoading(false);
      const canShare =
        offlineDemo &&
        isReferralLinkEligible({
          isActive: true,
          activeCapitalUsdt: activeCapital,
        });
      setEligible(canShare);
      setCode(canShare ? codeFromWallet(walletAddress) : null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchCurrentUser()
      .then((res) => {
        if (cancelled) return;
        if (!res.backend || !res.user) {
          setEligible(false);
          setCode(null);
          return;
        }
        const canShare = isReferralLinkEligible({
          isActive: res.user.isActive,
          activeCapitalUsdt: res.user.lockedCapital,
        });
        setEligible(canShare);
        setCode(canShare ? res.user.referralCode : null);
      })
      .catch(() => {
        if (!cancelled) {
          setEligible(false);
          setCode(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [backend, offlineDemo, walletAddress, activeCapital]);

  const link = code ? referralLink(code) : "";
  return { loading, eligible, code, link };
}
