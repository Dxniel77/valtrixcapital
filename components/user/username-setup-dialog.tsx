"use client";

import * as React from "react";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WelcomeModal } from "@/components/user/welcome-modal";
import { useI18n } from "@/lib/i18n/context";
import { pushNotification } from "@/lib/notifications/push";
import { updateCurrentUsername, ApiError } from "@/lib/api/client";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { useSiwe } from "@/lib/hooks/use-siwe";
import { getPendingReferralCode } from "@/lib/referrals/pending-sponsor";
import {
  markWelcomeSeen,
  syncProfileToAdmin,
  useUserRegistry,
  type UserProfile,
} from "@/lib/user/store";
import { normalizeWallet, validateUsername } from "@/lib/user/validation";

interface UsernameSetupDialogProps {
  open: boolean;
  wallet: string;
  onComplete: (profile: UserProfile) => void;
}

export function UsernameSetupDialog({
  open,
  wallet,
  onComplete,
}: UsernameSetupDialogProps) {
  const { t } = useI18n();
  const registerUsername = useUserRegistry((s) => s.registerUsername);
  const upsertProfileFromServer = useUserRegistry((s) => s.upsertProfileFromServer);
  const backend = useBackendAvailable();
  const { signIn } = useSiwe();
  const [username, setUsername] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [registeredProfile, setRegisteredProfile] =
    React.useState<UserProfile | null>(null);

  React.useEffect(() => {
    if (open) {
      setUsername("");
      setRegisteredProfile(null);
    }
  }, [open, wallet]);

  async function saveUsername(trimmed: string) {
    return updateCurrentUsername(trimmed, getPendingReferralCode());
  }

  async function submit() {
    setSubmitting(true);
    const trimmed = username.trim();
    const validationError = validateUsername(trimmed);
    if (validationError) {
      setSubmitting(false);
      toast.error(t("dashboard.pages.profile.usernameInvalid"));
      return;
    }

    if (backend) {
      try {
        const res = await saveUsername(trimmed);
        if (!res.user.username) {
          toast.error(t("dashboard.pages.profile.usernameInvalid"));
          setSubmitting(false);
          return;
        }
        const profile: UserProfile = {
          id: res.user.id,
          wallet: normalizeWallet(res.user.walletAddress),
          username: res.user.username,
          joinedAt: Date.now(),
        };
        upsertProfileFromServer(profile);
        syncProfileToAdmin(profile);
        setSubmitting(false);
        setRegisteredProfile(profile);
        return;
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            const signedIn = await signIn();
            if (signedIn) {
              try {
                const retry = await saveUsername(trimmed);
                if (!retry.user.username) {
                  toast.error(t("dashboard.pages.profile.usernameInvalid"));
                  setSubmitting(false);
                  return;
                }
                const profile: UserProfile = {
                  id: retry.user.id,
                  wallet: normalizeWallet(retry.user.walletAddress),
                  username: retry.user.username,
                  joinedAt: Date.now(),
                };
                upsertProfileFromServer(profile);
                syncProfileToAdmin(profile);
                setSubmitting(false);
                setRegisteredProfile(profile);
                return;
              } catch {
                toast.error(t("errors.signInFailed"));
                setSubmitting(false);
                return;
              }
            }
            toast.error(t("dashboard.pages.profile.signInRequired"));
          } else if (err.payload.code === "TAKEN") {
            toast.error(t("dashboard.pages.profile.usernameTaken"));
          } else {
            toast.error(t("dashboard.pages.profile.usernameInvalid"));
          }
        } else {
          toast.error(t("errors.signInFailed"));
        }
        setSubmitting(false);
        return;
      }
    }

    const result = registerUsername(wallet, trimmed);
    if (!result.ok) {
      setSubmitting(false);
      if (result.error === "TAKEN") {
        toast.error(t("dashboard.pages.profile.usernameTaken"));
      } else if (result.error === "WALLET_REGISTERED") {
        toast.error(t("dashboard.pages.profile.usernameInvalid"));
      } else {
        toast.error(t("dashboard.pages.profile.usernameInvalid"));
      }
      return;
    }

    syncProfileToAdmin(result.profile);
    setSubmitting(false);
    setRegisteredProfile(result.profile);
  }

  function finishWelcome() {
    if (!registeredProfile) return;

    markWelcomeSeen(registeredProfile.wallet);
    pushNotification({
      kind: "system",
      title: t("notifications.events.welcomeTitle"),
      body: t("notifications.events.welcomeBody"),
      href: "/dashboard",
      dedupeKey: `welcome_${registeredProfile.wallet}`,
    });
    onComplete(registeredProfile);
    setRegisteredProfile(null);
  }

  return (
    <>
      <Dialog open={open && !registeredProfile}>
        <DialogContent showClose={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-gold" />
              {t("dashboard.pages.profile.setupTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("dashboard.pages.profile.setupDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-text-muted">
                {t("dashboard.pages.profile.username")}
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("dashboard.pages.profile.setupPlaceholder")}
                autoComplete="username"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
              <p className="text-xs text-text-muted">
                {t("dashboard.pages.profile.setupHint")}
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="primary"
              size="md"
              loading={submitting}
              disabled={!username.trim()}
              onClick={submit}
            >
              {t("dashboard.pages.profile.setupConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {registeredProfile ? (
        <WelcomeModal
          open
          profile={registeredProfile}
          onDismiss={finishWelcome}
        />
      ) : null}
    </>
  );
}
