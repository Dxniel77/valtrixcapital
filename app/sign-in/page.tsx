"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { ConnectWalletButton } from "@/components/web3/connect-wallet-button";
import { UsernameSetupDialog } from "@/components/user/username-setup-dialog";
import { useSiwe } from "@/lib/hooks/use-siwe";
import { useI18n } from "@/lib/i18n/context";
import { useUserRegistry } from "@/lib/user/store";
import { ShieldCheck, Wallet, KeyRound, UserRound, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const { t } = useI18n();
  const { isConnected, address } = useAccount();
  const { signIn, loading, error, user } = useSiwe();
  const getProfile = useUserRegistry((s) => s.getProfile);
  const [profile, setProfile] = React.useState(
    () => getProfile(address) ?? null,
  );
  const [showUsernameDialog, setShowUsernameDialog] = React.useState(false);

  React.useEffect(() => {
    setProfile(getProfile(address) ?? null);
  }, [address, getProfile]);

  React.useEffect(() => {
    if (user && profile) router.replace(nextPath);
  }, [user, profile, router, nextPath]);

  React.useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  React.useEffect(() => {
    if (user && isConnected && address && !profile) {
      setShowUsernameDialog(true);
    }
  }, [user, isConnected, address, profile]);

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4 z-10">
        <LanguageSelector />
      </div>
      <div className="absolute inset-0 -z-10 grid-bg opacity-50" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[480px] bg-hero-radial" />

      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" showWordmark />
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="text-center">{t("signIn.title")}</CardTitle>
            <p className="text-center text-sm text-text-secondary">
              {t("signIn.subtitle")}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <Step
              n={1}
              icon={Wallet}
              title={t("signIn.step1Title")}
              done={isConnected}
              cta={!isConnected ? <ConnectWalletButton size="md" /> : null}
            >
              {isConnected ? (
                <p className="font-mono text-xs text-text-secondary">
                  {t("signIn.step1Connected")}{" "}
                  <span className="text-text-primary">
                    {address?.slice(0, 6)}…{address?.slice(-4)}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-text-muted">{t("signIn.step1Hint")}</p>
              )}
            </Step>

            <Step
              n={2}
              icon={KeyRound}
              title={t("signIn.step2Title")}
              done={!!user}
              cta={
                isConnected ? (
                  <Button
                    size="md"
                    variant="primary"
                    onClick={signIn}
                    loading={loading}
                    disabled={!!user}
                  >
                    {user ? t("signIn.signed") : t("signIn.signIn")}
                    {!user ? <ArrowRight className="h-4 w-4" /> : null}
                  </Button>
                ) : null
              }
            >
              <p className="text-xs text-text-muted">{t("signIn.step2Hint")}</p>
            </Step>

            <Step
              n={3}
              icon={UserRound}
              title={t("signIn.step3Title")}
              done={!!profile}
              cta={
                user && isConnected && !profile ? (
                  <Button
                    size="md"
                    variant="primary"
                    onClick={() => setShowUsernameDialog(true)}
                  >
                    {t("signIn.step3Title")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : null
              }
            >
              <p className="text-xs text-text-muted">{t("signIn.step3Hint")}</p>
            </Step>

            <div className="rounded-md border border-border-subtle bg-bg-base/60 p-3 text-xs text-text-secondary">
              <span className="inline-flex items-center gap-1.5 text-success">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="font-medium">{t("signIn.nonCustodial")}</span>
              </span>
              <span className="ml-2">{t("signIn.nonCustodialDesc")}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {address ? (
        <UsernameSetupDialog
          open={showUsernameDialog}
          wallet={address}
          onComplete={(next) => {
            setProfile(next);
            setShowUsernameDialog(false);
            if (user) router.replace(nextPath);
          }}
        />
      ) : null}
    </div>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  done,
  children,
  cta,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  done: boolean;
  children: React.ReactNode;
  cta?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        done
          ? "border-success/30 bg-success/5"
          : "border-border-subtle bg-bg-base/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-xs ${
              done
                ? "bg-success/15 text-success"
                : "border border-border-subtle bg-bg-hover text-text-secondary"
            }`}
          >
            {done ? <Icon className="h-4 w-4" /> : n}
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-primary">{title}</p>
            {children}
          </div>
        </div>
        {cta ? <div className="shrink-0">{cta}</div> : null}
      </div>
    </div>
  );
}
