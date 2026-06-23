"use client";

import { useAccount } from "wagmi";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { useSiwe } from "@/lib/hooks/use-siwe";

/** True when the dashboard may show private portfolio / balance data. */
export function useDashboardAccess(): {
  ready: boolean;
  allowed: boolean;
} {
  const backend = useBackendAvailable();
  const { user, checked } = useSiwe();
  const { isConnected, status } = useAccount();

  const walletSettling =
    status === "connecting" || status === "reconnecting";

  if (backend) {
    if (!checked || walletSettling) {
      return { ready: false, allowed: false };
    }
    if (!user || !isConnected) {
      return { ready: true, allowed: false };
    }
    return { ready: true, allowed: true };
  }

  if (walletSettling) {
    return { ready: false, allowed: false };
  }
  return { ready: true, allowed: isConnected };
}
