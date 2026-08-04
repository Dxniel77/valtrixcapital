"use client";

import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ConnectWalletButton } from "@/components/web3/connect-wallet-button";
import { CHAIN_META } from "@/lib/wagmi";
import { shortenAddress } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { useSiwe } from "@/lib/hooks/use-siwe";
import { useUserRegistry } from "@/lib/user/store";
import { formatMemberSince } from "@/lib/user/format";
import { useWithdrawalEligibility } from "@/lib/hooks/use-admin-user-sync";
import { IbBoostBadge } from "@/components/ib/ib-boost-badge";

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const chain = chainId ? CHAIN_META[chainId] : null;
  const profile = useUserRegistry((s) => s.getProfile(address));
  const { user } = useSiwe();
  const isAdmin = user?.role === "ADMIN";
  const { adminUser } = useWithdrawalEligibility();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.pages.profile.title")}
        subtitle={t("dashboard.pages.profile.subtitle")}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.pages.profile.walletCard")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Row label={t("dashboard.pages.profile.status")}>
              {isConnected ? (
                <Badge variant="success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  {t("dashboard.pages.profile.connected")}
                </Badge>
              ) : (
                <Badge variant="warning">
                  {t("dashboard.pages.profile.disconnected")}
                </Badge>
              )}
            </Row>
            <Separator />
            <Row label={t("dashboard.pages.profile.address")}>
              {address ? (
                <span className="font-mono text-text-primary">
                  {shortenAddress(address, 10, 8)}
                </span>
              ) : (
                <span className="text-text-muted">
                  {t("dashboard.pages.profile.notConnected")}
                </span>
              )}
            </Row>
            <Separator />
            <Row label={t("dashboard.pages.profile.network")}>
              {chain ? (
                <Badge variant="gold">{chain.name}</Badge>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </Row>
            <Separator />
            <Row label={t("dashboard.pages.profile.account")}>
              <ConnectWalletButton variant="outline" size="sm" />
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.pages.profile.accountCard")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Row label={t("dashboard.pages.profile.username")}>
              {profile ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="gold">{profile.username}</Badge>
                  <IbBoostBadge boost={adminUser?.ibBoost} showName />
                </div>
              ) : (
                <span className="text-text-muted">
                  {t("dashboard.pages.profile.usernameNotSet")}
                </span>
              )}
            </Row>
            <Separator />
            <Row label={t("dashboard.pages.profile.memberSince")}>
              {profile ? (
                <span className="font-mono text-text-primary">
                  {formatMemberSince(profile.joinedAt, locale)}
                </span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </Row>
          </CardContent>
        </Card>
      </div>

      {isAdmin ? (
        <Card className="border-gold/30">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gold/30 bg-gold/10 text-gold">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-base font-semibold text-text-primary">
                  {t("dashboard.overview.adminPanel")}
                </p>
                <p className="text-xs text-text-secondary">
                  {t("admin.headerLive")}
                </p>
              </div>
            </div>
            <Button asChild variant="primary" size="md">
              <Link href="/admin">{t("dashboard.overview.adminPanel")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      <span className="flex items-center gap-2">{children}</span>
    </div>
  );
}
