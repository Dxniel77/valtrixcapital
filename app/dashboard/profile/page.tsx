"use client";

import { useAccount, useChainId } from "wagmi";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConnectWalletButton } from "@/components/web3/connect-wallet-button";
import { CHAIN_META } from "@/lib/wagmi";
import { shortenAddress } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

export default function ProfilePage() {
  const { t } = useI18n();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const chain = chainId ? CHAIN_META[chainId] : null;

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
            <Row label={t("dashboard.pages.profile.role")}>
              <Badge>{t("common.user")}</Badge>
            </Row>
            <Separator />
            <Row label={t("dashboard.pages.profile.memberSince")}>
              <span className="font-mono text-text-primary">Mayo 2026</span>
            </Row>
            <Separator />
            <Row label={t("dashboard.pages.profile.twoFa")}>
              <Badge variant="warning">
                {t("dashboard.pages.profile.comingWeek6")}
              </Badge>
            </Row>
            <Separator />
            <Row label={t("dashboard.pages.profile.email")}>
              <span className="text-text-muted">
                {t("dashboard.pages.profile.emailOptional")}
              </span>
            </Row>
          </CardContent>
        </Card>
      </div>
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
