"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, LineChart, Sparkles, Wallet } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
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
import type { UserProfile } from "@/lib/user/store";

interface WelcomeModalProps {
  open: boolean;
  profile: UserProfile;
  onDismiss: () => void;
}

export function WelcomeModal({ open, profile, onDismiss }: WelcomeModalProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDismiss()}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="relative border-b border-border-subtle bg-hero-radial px-6 pb-5 pt-6">
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
          <div className="relative flex flex-col items-center text-center">
            <Logo size="lg" asLink={false} />
            <DialogHeader className="mt-4 border-0 p-0 text-center">
              <DialogTitle className="text-xl">
                {t("dashboard.pages.profile.welcomeModal.title", {
                  username: profile.username,
                })}
              </DialogTitle>
              <DialogDescription className="mx-auto max-w-sm">
                {t("dashboard.pages.profile.welcomeModal.subtitle")}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <DialogBody className="space-y-3">
          <WelcomeHighlight
            icon={Sparkles}
            title={t("dashboard.pages.profile.welcomeModal.step1Title")}
            body={t("dashboard.pages.profile.welcomeModal.step1Body")}
          />
          <WelcomeHighlight
            icon={Wallet}
            title={t("dashboard.pages.profile.welcomeModal.step2Title")}
            body={t("dashboard.pages.profile.welcomeModal.step2Body")}
          />
          <WelcomeHighlight
            icon={LineChart}
            title={t("dashboard.pages.profile.welcomeModal.step3Title")}
            body={t("dashboard.pages.profile.welcomeModal.step3Body")}
          />
        </DialogBody>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button variant="primary" size="md" className="w-full" onClick={onDismiss}>
            {t("dashboard.pages.profile.welcomeModal.cta")}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/dashboard/wallet" onClick={onDismiss}>
              {t("dashboard.pages.profile.welcomeModal.ctaDeposit")}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WelcomeHighlight({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border-subtle bg-bg-base/50 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gold/10 text-gold">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="mt-0.5 text-xs text-text-secondary">{body}</p>
      </div>
    </div>
  );
}
