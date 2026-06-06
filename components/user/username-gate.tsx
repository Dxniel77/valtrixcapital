"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { UsernameSetupDialog } from "@/components/user/username-setup-dialog";
import { useUserRegistry } from "@/lib/user/store";

export function UsernameGate({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const getProfile = useUserRegistry((s) => s.getProfile);
  const [hydrated, setHydrated] = React.useState(false);
  const [profile, setProfile] = React.useState(
    () => getProfile(address) ?? null,
  );

  React.useEffect(() => {
    const unsub = useUserRegistry.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useUserRegistry.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    setProfile(getProfile(address) ?? null);
  }, [address, getProfile, hydrated]);

  const needsUsername = hydrated && isConnected && !!address && !profile;

  return (
    <>
      {children}
      {needsUsername ? (
        <UsernameSetupDialog
          open
          wallet={address}
          onComplete={setProfile}
        />
      ) : null}
    </>
  );
}
