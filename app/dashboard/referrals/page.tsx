"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { QRCodeSVG } from "qrcode.react";
import { Coins, Link2, Network, Users } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareButtons } from "@/components/referrals/share-buttons";
import { NetworkMembersPanel } from "@/components/referrals/network-members-panel";
import { useI18n } from "@/lib/i18n/context";
import {
  useReferralLevelStats,
  useReferralsStore,
  useReferralsStoreHydrated,
} from "@/lib/referrals/store";
import { useReferralInvite } from "@/lib/referrals/use-referral-invite";
import { useMyReferrer } from "@/lib/referrals/use-my-referrer";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { useReferralsServerLoaded } from "@/lib/hooks/use-referrals-sync";
import { formatNumber, shortenAddress } from "@/lib/utils";

export default function ReferralsPage() {
  const { t } = useI18n();
  const { address } = useAccount();
  const hydrated = useReferralsStoreHydrated();
  const backend = useBackendAvailable();
  const networkLoaded = useReferralsServerLoaded();

  const commissions = useReferralsStore((s) => s.commissions);
  const totalCommissions = useReferralsStore((s) => s.totalCommissions);
  const downline = useReferralsStore((s) => s.downline);
  const levelStats = useReferralLevelStats();
  const myReferrer = useMyReferrer();
  const invite = useReferralInvite(address);

  const link = invite.eligible ? invite.link : "";
  const code = invite.eligible ? invite.code : null;
  const totalMembers = downline.length;
  const activeMembers = downline.filter((m) => m.isActive).length;
  const directReferrals = downline.filter((m) => m.level === 1).length;
  const networkReferrals = totalMembers - directReferrals;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("referralsPage.title")}
        subtitle={t("referralsPage.subtitle")}
      />

      {myReferrer ? (
        <Card className="border-gold/30 bg-gold/5">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
            <Users className="h-4 w-4 text-gold" />
            <span className="text-text-secondary">
              {t("referralsPage.referredBy")}
            </span>
            <span className="font-medium text-text-primary">
              {myReferrer.displayName}
            </span>
            <span className="font-mono text-xs text-text-muted">
              ({shortenAddress(myReferrer.wallet)})
            </span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label={t("referralsPage.totalNetwork")}
          value={String(totalMembers)}
          icon={Network}
          accent="gold"
          hint={t("referralsPage.acrossLevels")}
        />
        <StatTile
          label={t("referralsPage.directReferrals")}
          value={String(directReferrals)}
          icon={Link2}
          accent="info"
          hint={t("referralsPage.directHint")}
        />
        <StatTile
          label={t("referralsPage.networkReferrals")}
          value={String(networkReferrals)}
          icon={Users}
          accent="silver"
          hint={t("referralsPage.networkHint")}
        />
        <StatTile
          label={t("referralsPage.activeMembers")}
          value={String(activeMembers)}
          icon={Users}
          accent="success"
          hint={t("referralsPage.activeHint")}
        />
        <StatTile
          label={t("referralsPage.commissionsEarned")}
          value={`$${formatNumber(totalCommissions, { decimals: 2 })}`}
          icon={Coins}
          accent="info"
          hint={t("referralsPage.creditedToBalance")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <InviteCard
          link={link}
          code={code}
          hydrated={hydrated}
          loading={invite.loading}
          eligible={invite.eligible}
        />
        <LevelsCard levelStats={levelStats} />
      </div>

      <CommissionLedgerCard commissions={commissions} />

      <NetworkMembersPanel
        members={downline}
        levelStats={levelStats}
        loading={backend && hydrated && !networkLoaded}
      />
    </div>
  );
}

function InviteCard({
  link,
  code,
  hydrated,
  loading,
  eligible,
}: {
  link: string;
  code: string | null;
  hydrated: boolean;
  loading: boolean;
  eligible: boolean;
}) {
  const { t } = useI18n();
  const showInvite = hydrated && !loading && eligible;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>{t("referralsPage.inviteTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!showInvite ? (
          <div className="rounded-lg border border-dashed border-border-subtle bg-bg-base/40 px-4 py-8 text-center">
            {loading || !hydrated ? (
              <div className="mx-auto h-4 w-48 animate-pulse rounded bg-bg-hover" />
            ) : (
              <>
                <p className="text-sm font-medium text-text-primary">
                  {t("referralsPage.linkDisabledTitle")}
                </p>
                <p className="mt-2 text-sm text-text-muted">
                  {t("referralsPage.linkDisabledHint")}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div className="rounded-xl border border-border-subtle bg-white p-3">
                {link ? (
                  <QRCodeSVG
                    value={link}
                    size={132}
                    bgColor="#ffffff"
                    fgColor="#0A0A0F"
                    level="M"
                  />
                ) : (
                  <div className="h-[132px] w-[132px] animate-pulse rounded bg-bg-hover" />
                )}
              </div>
              <span className="text-xs text-text-muted">
                {t("referralsPage.scanToJoin")}
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-text-muted">
                  {t("referralsPage.yourCode")}
                </label>
                <div className="flex h-11 items-center rounded-md border border-border-subtle bg-bg-base px-3 font-mono text-lg text-gold">
                  {code ?? "—"}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-text-muted">
                  {t("referralsPage.yourLink")}
                </label>
                <div className="flex h-11 items-center overflow-hidden rounded-md border border-border-subtle bg-bg-base px-3">
                  <span className="truncate font-mono text-sm text-text-secondary">
                    {link || "…"}
                  </span>
                </div>
              </div>
              <ShareButtons link={link} disabled={!link} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LevelsCard({
  levelStats,
}: {
  levelStats: ReturnType<typeof useReferralLevelStats>;
}) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            {t("referralsPage.commissionTiers")}
          </CardTitle>
          <Badge variant="gold">8</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border-subtle">
          {levelStats.map((lvl) => (
            <li
              key={lvl.level}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="text-text-secondary">
                {t("referrals.level", { n: lvl.level })}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">
                  {lvl.active}/{lvl.total}
                </span>
                <span className="w-12 text-right font-mono text-gold">
                  {(lvl.rateBps / 100).toFixed(2)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CommissionLedgerCard({
  commissions,
}: {
  commissions: ReturnType<typeof useReferralsStore.getState>["commissions"];
}) {
  const { t } = useI18n();
  const recent = commissions.slice(0, 12);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t("referralsPage.ledgerTitle")}</CardTitle>
          <Badge variant="default">
            {t("referralsPage.ledgerCount", { n: commissions.length })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-subtle bg-bg-base/40 p-6 text-center">
            <p className="text-sm text-text-secondary">
              {t("referralsPage.ledgerEmpty")}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {recent.map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5 text-xs"
              >
                <Badge variant="gold">
                  {t("referrals.level", { n: c.level })}
                </Badge>
                <span className="min-w-0">
                  <span className="block font-mono text-text-secondary">
                    {shortenAddress(c.sourceWallet, 6, 4)}
                  </span>
                  <span className="text-text-muted">{c.yieldDate}</span>
                </span>
                <span className="text-right font-mono text-success">
                  +${formatNumber(c.amount, { decimals: 4 })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}