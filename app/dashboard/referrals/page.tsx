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
import { useI18n } from "@/lib/i18n/context";
import {
  referralLink,
  useReferralLevelStats,
  useReferralsStore,
  useReferralsStoreHydrated,
} from "@/lib/referrals/store";
import { formatNumber, shortenAddress } from "@/lib/utils";

export default function ReferralsPage() {
  const { t } = useI18n();
  const { address } = useAccount();
  const hydrated = useReferralsStoreHydrated();

  const ensureCode = useReferralsStore((s) => s.ensureCode);
  const code = useReferralsStore((s) => s.referralCode);
  const commissions = useReferralsStore((s) => s.commissions);
  const totalCommissions = useReferralsStore((s) => s.totalCommissions);
  const downline = useReferralsStore((s) => s.downline);
  const levelStats = useReferralLevelStats();

  React.useEffect(() => {
    if (hydrated) ensureCode(address);
  }, [hydrated, address, ensureCode]);

  const link = code ? referralLink(code) : "";
  const totalMembers = downline.length;
  const activeMembers = downline.filter((m) => m.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("referralsPage.title")}
        subtitle={t("referralsPage.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("referralsPage.totalNetwork")}
          value={String(totalMembers)}
          icon={Network}
          accent="gold"
          hint={t("referralsPage.acrossLevels")}
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
        <StatTile
          label={t("referralsPage.levels")}
          value="8"
          icon={Link2}
          accent="silver"
          hint={t("referralsPage.levelsHint")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <InviteCard link={link} code={code} hydrated={hydrated} />
        <LevelsCard levelStats={levelStats} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DownlineTreeCard levelStats={levelStats} />
        <CommissionLedgerCard commissions={commissions} />
      </div>
    </div>
  );
}

function InviteCard({
  link,
  code,
  hydrated,
}: {
  link: string;
  code: string | null;
  hydrated: boolean;
}) {
  const { t } = useI18n();
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>{t("referralsPage.inviteTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="rounded-xl border border-border-subtle bg-white p-3">
              {hydrated && link ? (
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
                {hydrated ? (code ?? "—") : "—"}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-text-muted">
                {t("referralsPage.yourLink")}
              </label>
              <div className="flex h-11 items-center overflow-hidden rounded-md border border-border-subtle bg-bg-base px-3">
                <span className="truncate font-mono text-sm text-text-secondary">
                  {hydrated && link ? link : "…"}
                </span>
              </div>
            </div>
            <ShareButtons link={link} />
          </div>
        </div>
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

function DownlineTreeCard({
  levelStats,
}: {
  levelStats: ReturnType<typeof useReferralLevelStats>;
}) {
  const { t } = useI18n();
  const maxTotal = Math.max(1, ...levelStats.map((l) => l.total));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("referralsPage.networkTree")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {levelStats.map((lvl) => (
          <div key={lvl.level} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">
                {t("referrals.level", { n: lvl.level })}
              </span>
              <span className="font-mono text-text-muted">
                <span className="text-success">{lvl.active}</span> /{" "}
                {lvl.total} · +${formatNumber(lvl.earned, { decimals: 2 })}
              </span>
            </div>
            <div className="flex h-6 overflow-hidden rounded-md bg-bg-base">
              <div
                className="flex items-center bg-gradient-to-r from-gold/30 to-gold/70 transition-[width] duration-500"
                style={{ width: `${(lvl.total / maxTotal) * 100}%` }}
              >
                <span className="px-2 font-mono text-[10px] text-text-inverse">
                  {lvl.total > 0 ? lvl.total : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
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