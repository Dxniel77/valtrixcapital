"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { UsernameSetupDialog } from "@/components/user/username-setup-dialog";
import { WelcomeModal } from "@/components/user/welcome-modal";
import { pushNotification } from "@/lib/notifications/push";
import { useI18n } from "@/lib/i18n/context";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { useHydrateProfileFromServer } from "@/lib/hooks/use-hydrate-profile-from-server";
import { useSiwe } from "@/lib/hooks/use-siwe";
import {
  markWelcomeSeen,
  useUserRegistry,
  type UserProfile,
} from "@/lib/user/store";

export function UsernameGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const backend = useBackendAvailable();
  const { user: sessionUser, checked: sessionChecked } = useSiwe();
  const { profile, serverChecked } = useHydrateProfileFromServer(address);
  const hasSeenWelcome = useUserRegistry((s) => s.hasSeenWelcome);
  const [hydrated, setHydrated] = React.useState(false);
  const [resumeWelcome, setResumeWelcome] = React.useState(false);

  React.useEffect(() => {
    const unsub = useUserRegistry.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useUserRegistry.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    setResumeWelcome(!!profile && !!address && !hasSeenWelcome(address));
  }, [address, profile, hasSeenWelcome, hydrated]);

  const needsUsername =
    hydrated && serverChecked && isConnected && !!address && !profile;
  const needsSignIn =
    needsUsername && backend && sessionChecked && !sessionUser;

  React.useEffect(() => {
    if (!needsSignIn) return;
    const next = pathname.startsWith("/") ? pathname : "/dashboard";
    router.replace(`/sign-in?next=${encodeURIComponent(next)}`);
  }, [needsSignIn, pathname, router]);

  const showUsernameSetup =
    needsUsername && (!backend || (sessionChecked && !!sessionUser));

  function handleWelcomeDismiss() {
    if (!profile) return;
    markWelcomeSeen(profile.wallet);
    pushNotification({
      kind: "system",
      title: t("notifications.events.welcomeTitle"),
      body: t("notifications.events.welcomeBody"),
      href: "/dashboard",
      dedupeKey: `welcome_${profile.wallet}`,
    });
    setResumeWelcome(false);
  }

  function handleUsernameComplete(nextProfile: UserProfile) {
    setResumeWelcome(!hasSeenWelcome(nextProfile.wallet));
  }

  return (
    <>
      {children}
      {showUsernameSetup ? (
        <UsernameSetupDialog
          open
          wallet={address}
          onComplete={handleUsernameComplete}
        />
      ) : null}
      {resumeWelcome && profile ? (
        <WelcomeModal
          open
          profile={profile}
          onDismiss={handleWelcomeDismiss}
        />
      ) : null}
    </>
  );
}
