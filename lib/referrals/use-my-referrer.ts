"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { useAdminStore } from "@/lib/admin/store";
import { getReferrerInfo } from "@/lib/admin/sponsor";
import { useReferralsStore, type MyReferrer } from "@/lib/referrals/store";
import { shortenAddress } from "@/lib/utils";

/** Who referred the connected user (backend sync or local admin registry). */
export function useMyReferrer(): MyReferrer | null {
  const { address } = useAccount();
  const users = useAdminStore((s) => s.users);
  const stored = useReferralsStore((s) => s.myReferrer);
  const setMyReferrer = useReferralsStore((s) => s.setMyReferrer);

  const localReferrer = React.useMemo(() => {
    if (!address) return null;
    const me = users.find(
      (u) => u.wallet.toLowerCase() === address.toLowerCase(),
    );
    if (!me) return null;
    const info = getReferrerInfo(me, users);
    if (!info) return null;
    return { wallet: info.wallet, displayName: info.displayName };
  }, [address, users]);

  React.useEffect(() => {
    if (stored || !localReferrer) return;
    setMyReferrer(localReferrer);
  }, [stored, localReferrer, setMyReferrer]);

  const referrer = stored ?? localReferrer;
  if (!referrer) return null;

  return {
    wallet: referrer.wallet,
    displayName: referrer.displayName || shortenAddress(referrer.wallet),
  };
}
