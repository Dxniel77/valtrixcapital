"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { UsernameSetupDialog } from "@/components/user/username-setup-dialog";
import { WelcomeModal } from "@/components/user/welcome-modal";
import { pushNotification } from "@/lib/notifications/push";
import { useI18n } from "@/lib/i18n/context";
import {
  markWelcomeSeen,
  useUserRegistry,
  type UserProfile,
} from "@/lib/user/store";

export function UsernameGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { address, isConnected } = useAccount();
  const getProfile = useUserRegistry((s) => s.getProfile);
  const hasSeenWelcome = useUserRegistry((s) => s.hasSeenWelcome);
  const [hydrated, setHydrated] = React.useState(false);
  const [profile, setProfile] = React.useState(
    () => getProfile(address) ?? null,
  );
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
    const nextProfile = getProfile(address) ?? null;
    setProfile(nextProfile);
    setResumeWelcome(
      !!nextProfile && !!address && !hasSeenWelcome(address),
    );
  }, [address, getProfile, hasSeenWelcome, hydrated]);

  const needsUsername = hydrated && isConnected && !!address && !profile;

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
    setProfile(nextProfile);
    setResumeWelcome(false);
  }

  return (
    <>
      {children}
      {needsUsername ? (
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
