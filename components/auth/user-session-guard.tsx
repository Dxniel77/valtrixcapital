"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { useSiwe } from "@/lib/hooks/use-siwe";
import { clearUserSessionData } from "@/lib/session/clear-user-data";
import { normalizeWallet } from "@/lib/user/validation";

export function UserSessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const backend = useBackendAvailable();
  const { user, checked, signOut } = useSiwe();
  const { isConnected, address, status } = useAccount();
  const [allowed, setAllowed] = React.useState(false);
  const prevConnectedRef = React.useRef<boolean | null>(null);
  const redirectingRef = React.useRef(false);

  const walletSettling =
    status === "connecting" || status === "reconnecting";

  const redirectToSignIn = React.useCallback(
    async (destroySession: boolean) => {
      if (redirectingRef.current) return;
      redirectingRef.current = true;
      setAllowed(false);
      clearUserSessionData();
      if (destroySession) {
        try {
          await signOut();
        } catch {
          clearUserSessionData();
        }
      }
      router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
    },
    [pathname, router, signOut],
  );

  React.useEffect(() => {
    if (walletSettling) return;

    const wasConnected = prevConnectedRef.current;
    prevConnectedRef.current = isConnected;

    if (wasConnected === true && !isConnected) {
      void redirectToSignIn(true);
      return;
    }

    if (backend) {
      if (!checked) return;

      if (!user || !isConnected) {
        void redirectToSignIn(!!user);
        return;
      }

      if (
        address &&
        normalizeWallet(user.address) !== normalizeWallet(address)
      ) {
        void redirectToSignIn(true);
        return;
      }
    } else if (!isConnected) {
      void redirectToSignIn(false);
      return;
    }

    redirectingRef.current = false;
    setAllowed(true);
  }, [
    backend,
    checked,
    user,
    isConnected,
    address,
    walletSettling,
    redirectToSignIn,
  ]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base" />
    );
  }

  return <>{children}</>;
}
