"use client";

import * as React from "react";
import { fetchCurrentUser } from "@/lib/api/client";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { useSiwe } from "@/lib/hooks/use-siwe";
import { useUserRegistry } from "@/lib/user/store";
import { normalizeWallet } from "@/lib/user/validation";

/**
 * Ensures the local profile store reflects a username already saved on the server.
 * Prevents re-prompting returning users after logout or cleared local storage.
 */
export function useHydrateProfileFromServer(wallet?: string) {
  const backend = useBackendAvailable();
  const { user: sessionUser, checked: sessionChecked } = useSiwe();
  const upsertProfileFromServer = useUserRegistry(
    (s) => s.upsertProfileFromServer,
  );
  const profile = useUserRegistry((s) =>
    wallet ? (s.getProfile(wallet) ?? null) : null,
  );
  const [serverChecked, setServerChecked] = React.useState(false);

  React.useEffect(() => {
    if (!wallet) {
      setServerChecked(false);
      return;
    }

    if (profile) {
      setServerChecked(true);
      return;
    }

    if (!backend) {
      setServerChecked(true);
      return;
    }

    if (!sessionChecked || !sessionUser) {
      setServerChecked(false);
      return;
    }

    let cancelled = false;
    setServerChecked(false);

    void fetchCurrentUser()
      .then((res) => {
        if (cancelled || !res.backend || !res.user?.username) return;
        upsertProfileFromServer({
          id: res.user.id,
          wallet: normalizeWallet(res.user.walletAddress),
          username: res.user.username,
          joinedAt: res.user.createdAt
            ? new Date(res.user.createdAt).getTime()
            : Date.now(),
        });
      })
      .finally(() => {
        if (!cancelled) setServerChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [
    wallet,
    profile,
    backend,
    sessionChecked,
    sessionUser,
    upsertProfileFromServer,
  ]);

  return { profile, serverChecked };
}
