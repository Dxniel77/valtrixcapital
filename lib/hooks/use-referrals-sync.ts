"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { fetchReferralSnapshot } from "@/lib/api/client";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { useReferralsStore } from "@/lib/referrals/store";

const DEFAULT_POLL_MS = 15_000;
const REFERRALS_PAGE_POLL_MS = 8_000;

/** Pulls latest downline + commission ledger from Postgres into the referrals store. */
export async function refreshReferralsSnapshot(): Promise<boolean> {
  try {
    const { snapshot } = await fetchReferralSnapshot();
    if (!snapshot) return false;
    useReferralsStore.getState().hydrateFromServer(snapshot);
    return true;
  } catch {
    return false;
  }
}

/** Loads referral downline + commission ledger from Postgres. */
export function useReferralsSync(pollMs?: number): void {
  const backend = useBackendAvailable();
  const visible = usePageVisible();
  const pathname = usePathname();
  const { address } = useAccount();
  const hydrateFromServer = useReferralsStore((s) => s.hydrateFromServer);
  const prevWalletRef = React.useRef<string | null>(null);

  const intervalMs =
    pollMs ??
    (pathname?.startsWith("/dashboard/referrals")
      ? REFERRALS_PAGE_POLL_MS
      : DEFAULT_POLL_MS);

  React.useEffect(() => {
    if (!backend || !address) {
      prevWalletRef.current = null;
      return;
    }

    const wallet = address.toLowerCase();
    if (prevWalletRef.current !== wallet) {
      prevWalletRef.current = wallet;
      useReferralsStore.setState({
        serverSnapshotLoaded: false,
        downline: [],
        commissions: [],
        totalCommissions: 0,
      });
    }
  }, [backend, address]);

  React.useEffect(() => {
    if (!backend || !address || !visible) return;

    let cancelled = false;

    async function sync() {
      try {
        const { snapshot } = await fetchReferralSnapshot();
        if (cancelled || !snapshot) return;
        hydrateFromServer(snapshot);
      } catch {
        /* keep previous snapshot */
      }
    }

    void sync();
    const timer = window.setInterval(() => void sync(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [backend, address, visible, hydrateFromServer, intervalMs]);
}

export function useReferralsServerLoaded(): boolean {
  const backend = useBackendAvailable();
  const loaded = useReferralsStore((s) => s.serverSnapshotLoaded);
  return !backend || loaded;
}
