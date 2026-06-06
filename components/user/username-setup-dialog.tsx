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
import { useI18n } from "@/lib/i18n/context";
import {
  syncProfileToAdmin,
  useUserRegistry,
  type UserProfile,
} from "@/lib/user/store";

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
  const [username, setUsername] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) setUsername("");
  }, [open, wallet]);

  function submit() {
    setSubmitting(true);
    const result = registerUsername(wallet, username);
    setSubmitting(false);

    if (!result.ok) {
      if (result.error === "TAKEN") {
        toast.error(t("dashboard.pages.profile.usernameTaken"));
      } else {
        toast.error(t("dashboard.pages.profile.usernameInvalid"));
      }
      return;
    }

    syncProfileToAdmin(result.profile);
    toast.success(t("dashboard.pages.profile.usernameSaved"));
    onComplete(result.profile);
  }

  return (
    <Dialog open={open}>
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
  );
}
