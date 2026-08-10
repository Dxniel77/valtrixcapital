"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/context";
import type { UserDetailSnapshot } from "@/lib/admin/analytics";
import { useAdminStore } from "@/lib/admin/store";
import { exportUserDetailCsv } from "@/lib/admin/exports";
import { ChangeSponsorCard } from "@/components/admin/change-sponsor-card";
import { AdminUserAccountCard } from "@/components/admin/admin-user-account-card";
import { AdminUserSponsorshipCard } from "@/components/admin/admin-user-sponsorship-card";
import { AdminPartialWithdrawalReleaseCard } from "@/components/admin/admin-partial-withdrawal-release-card";
import { AdminManualPayoutCard } from "@/components/admin/admin-manual-payout-card";
import { AdminIbAgreementCard } from "@/components/admin/admin-ib-agreement-card";
import { SponsoredUnlockProgressCard } from "@/components/wallet/sponsored-unlock-progress-card";
import { IbStatusBadge } from "@/components/ib/ib-status-badge";
import { findSponsorUser, getReferrerInfo } from "@/lib/admin/sponsor";
import { computeWithdrawableCap } from "@/lib/admin/withdrawal-eligibility";
import { cn, formatNumber, shortenAddress } from "@/lib/utils";

/** Amount the user can withdraw right now (respects sponsored partial release). */
function availableToWithdraw(user: {
  accountGranted: boolean;
  withdrawalUnlocked: boolean;
  withdrawalAllowance?: number;
  balance: number;
}): number {
  return computeWithdrawableCap({
    earningsBalance: user.balance,
    accountGranted: user.accountGranted,
    withdrawalUnlocked: user.withdrawalUnlocked,
    withdrawalAllowance: user.withdrawalAllowance,
  });
}

export function UserDetailPanel({
  detail,
  backHref,
  showBack = true,
}: {
  detail: UserDetailSnapshot;
  backHref?: string;
  showBack?: boolean;
}) {
  const { t } = useI18n();
  const users = useAdminStore((s) => s.users);
  const { user: detailUser, totals } = detail;
  const user =
    users.find((u) => u.id === detailUser.id) ?? detailUser;
  const isSponsored = user.accountGranted;
  const sponsor = React.useMemo(
    () => findSponsorUser(users, user.uplineWallet),
    [users, user.uplineWallet],
  );
  const referrer = React.useMemo(
    () => getReferrerInfo(user, users),
    [user, users],
  );

  const deposits = detail.movements.filter((m) => m.type === "DEPOSIT");
  const withdrawals = detail.movements.filter((m) => m.type === "WITHDRAWAL");
  const yields = detail.movements.filter((m) => m.type === "YIELD");
  const commissions = detail.movements.filter((m) => m.type === "COMMISSION");
  const pending = withdrawals.filter(
    (m) => m.status === "PROCESSING" || m.status === "REVIEW",
  );

  return (
    <div className="space-y-6">
      {showBack && backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("admin.userDetail.back")}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/40 bg-bg-elevated">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-display text-lg font-semibold text-gold/70">
                {(user.alias?.trim()?.[0] ?? "?").toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold text-text-primary">
            {user.alias}
          </h2>
          <p className="mt-0.5 font-mono text-xs text-text-muted">{user.wallet}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={user.status === "ACTIVE" ? "success" : "default"}>
              {user.status === "ACTIVE"
                ? t("admin.users.active")
                : t("admin.users.inactive")}
            </Badge>
            {user.role === "ADMIN" ? (
              <Badge variant="gold">{t("admin.users.adminBadge")}</Badge>
            ) : null}
            {isSponsored ? (
              <Badge variant="warning">{t("admin.users.sponsoredBadge")}</Badge>
            ) : null}
            <Badge
              variant={user.registrationSource === "referral" ? "gold" : "outline"}
            >
              {user.registrationSource === "referral"
                ? t("admin.users.registrationReferral")
                : t("admin.users.registrationDirect")}
            </Badge>
            {user.withdrawalUnlocked ? (
              <Badge variant="success">{t("admin.lookup.withdrawOk")}</Badge>
            ) : isSponsored ? (
              (user.withdrawalAllowance ?? 0) > 0 ? (
                <Badge variant="gold">{t("admin.lookup.withdrawPartial")}</Badge>
              ) : (
                <Badge variant="outline">{t("admin.lookup.withdrawLocked")}</Badge>
              )
            ) : null}
            <IbStatusBadge isIb={user.isIb} />
          </div>
          {referrer ? (
            <p className="mt-2 text-sm text-text-secondary">
              {t("admin.userDetail.referredBy")}:{" "}
              {referrer.adminUserId ? (
                <Link
                  href={`/admin/users/${referrer.adminUserId}`}
                  className="font-medium text-gold hover:underline"
                >
                  {referrer.displayName}
                </Link>
              ) : (
                <span className="font-medium text-text-primary">
                  {referrer.displayName}
                </span>
              )}
              <span className="ml-1.5 font-mono text-xs text-text-muted">
                ({shortenAddress(referrer.wallet)})
              </span>
            </p>
          ) : user.registrationSource === "direct" ? (
            <p className="mt-2 text-sm text-text-muted">
              {t("admin.userDetail.referredBy")}: {t("admin.users.referredByNone")}
            </p>
          ) : null}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportUserDetailCsv(detail)}
        >
          <Download className="h-3.5 w-3.5" />
          {t("admin.userDetail.exportCsv")}
        </Button>
      </div>

      <Card
        className={cn(
          isSponsored && "border-warning/40 bg-warning/5",
        )}
      >
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("admin.lookup.capital")} value={`$${formatNumber(totals.capital, { decimals: 0 })}`} />
          <Stat
            label={t("admin.partialRelease.balance")}
            value={`$${formatNumber(totals.balance, { decimals: 2 })}`}
          />
          <Stat
            label={t("admin.lookup.balance")}
            value={`$${formatNumber(availableToWithdraw(user), { decimals: 2 })}`}
            highlight={
              isSponsored &&
              !user.withdrawalUnlocked &&
              availableToWithdraw(user) < totals.balance
            }
          />
          <Stat label={t("admin.userDetail.totalEarned")} value={`$${formatNumber(totals.totalEarned, { decimals: 2 })}`} />
          <Stat label={t("admin.lookup.directRefs")} value={String(totals.directReferrals)} />
          <Stat
            label={t("admin.userDetail.registrationSource")}
            value={
              user.registrationSource === "referral"
                ? t("admin.users.registrationReferral")
                : t("admin.users.registrationDirect")
            }
          />
          <Stat
            label={t("admin.userDetail.referredBy")}
            value={
              referrer
                ? referrer.displayName
                : t("admin.users.referredByNone")
            }
          />
          <Stat
            label={t("admin.userDetail.sponsorCurrent")}
            value={sponsor ? sponsor.alias : t("admin.userDetail.sponsorNone")}
          />
          <Stat label={t("admin.lookup.networkSize")} value={String(totals.networkSize)} />
          <Stat label={t("admin.userDetail.totalDeposits")} value={`$${formatNumber(totals.totalDeposits, { decimals: 2 })}`} />
          <Stat label={t("admin.userDetail.totalWithdrawals")} value={`$${formatNumber(totals.totalWithdrawals, { decimals: 2 })}`} />
          <Stat
            label={t("admin.userDetail.pendingWithdrawals")}
            value={`$${formatNumber(totals.pendingWithdrawals, { decimals: 2 })} (${totals.pendingCount})`}
            highlight={totals.pendingCount > 0}
          />
        </CardContent>
      </Card>

      <ChangeSponsorCard user={user} />

      <AdminUserAccountCard user={user} />

      <AdminIbAgreementCard user={user} />

      <AdminManualPayoutCard user={user} />

      {isSponsored ? (
        <>
          <AdminUserSponsorshipCard user={user} />
          <AdminPartialWithdrawalReleaseCard user={user} />
          <SponsoredUnlockProgressCard user={user} />
        </>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <EarningsCard
          title={t("admin.lookup.operational")}
          amount={totals.operational}
        />
        <EarningsCard
          title={t("admin.lookup.network")}
          amount={totals.network}
        />
        <EarningsCard
          title={t("admin.lookup.passive")}
          amount={totals.passive}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.userDetail.directReferrals")}</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.directReferrals.length === 0 ? (
            <p className="text-sm text-text-muted">{t("admin.userDetail.noDirectRefs")}</p>
          ) : (
            <Table>
              <thead>
                <THeadRow>
                  <TH>{t("admin.users.colUser")}</TH>
                  <TH className="text-right">{t("admin.users.colCapital")}</TH>
                  <TH className="text-right">{t("admin.users.colBalance")}</TH>
                  <TH>{t("admin.users.colStatus")}</TH>
                </THeadRow>
              </thead>
              <TBody>
                {detail.directReferrals.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <p className="font-medium">{r.alias}</p>
                      <p className="font-mono text-xs text-text-muted">
                        {shortenAddress(r.wallet)}
                      </p>
                    </TD>
                    <TD className="text-right font-mono">
                      ${formatNumber(r.capital, { decimals: 0 })}
                    </TD>
                    <TD className="text-right font-mono text-gold">
                      ${formatNumber(r.balance, { decimals: 2 })}
                    </TD>
                    <TD>
                      <Badge variant={r.status === "ACTIVE" ? "success" : "default"}>
                        {r.status}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.lookup.networkLevels")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <THeadRow>
                <TH>{t("admin.lookup.level")}</TH>
                <TH className="text-right">{t("admin.lookup.members")}</TH>
                <TH className="text-right">{t("admin.lookup.volume")}</TH>
              </THeadRow>
            </thead>
            <TBody>
              {detail.networkByLevel.map((row) => (
                <TR key={row.level}>
                  <TD>L{row.level}</TD>
                  <TD className="text-right font-mono">{row.count}</TD>
                  <TD className="text-right font-mono">
                    ${formatNumber(row.volume, { decimals: 0 })}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <MovementSection
        title={t("admin.userDetail.investments")}
        rows={deposits}
        empty={t("admin.userDetail.noInvestments")}
      />
      <MovementSection
        title={t("admin.userDetail.earnings")}
        rows={yields}
        empty={t("admin.userDetail.noEarnings")}
      />
      <MovementSection
        title={t("admin.userDetail.networkCommissions")}
        rows={commissions}
        empty={t("admin.userDetail.noCommissions")}
      />
      <MovementSection
        title={t("admin.userDetail.withdrawals")}
        rows={withdrawals}
        empty={t("admin.userDetail.noWithdrawals")}
      />
      {pending.length > 0 ? (
        <MovementSection
          title={t("admin.userDetail.pending")}
          rows={pending}
          empty=""
          highlight
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.lookup.history")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MovementTable rows={detail.movements} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-lg text-text-primary",
          highlight && "text-warning",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EarningsCard({ title, amount }: { title: string; amount: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-text-muted">{title}</p>
        <p className="mt-1 font-mono text-xl text-gold">
          ${formatNumber(amount, { decimals: 2 })}
        </p>
      </CardContent>
    </Card>
  );
}

function MovementSection({
  title,
  rows,
  empty,
  highlight,
}: {
  title: string;
  rows: UserDetailSnapshot["movements"];
  empty: string;
  highlight?: boolean;
}) {
  return (
    <Card className={cn(highlight && "border-warning/40")}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-text-muted">{empty}</p>
        ) : (
          <MovementTable rows={rows} />
        )}
      </CardContent>
    </Card>
  );
}

function MovementTable({ rows }: { rows: UserDetailSnapshot["movements"] }) {
  const { t } = useI18n();
  return (
    <Table>
      <thead>
        <THeadRow>
          <TH>{t("admin.movements.colDate")}</TH>
          <TH>{t("admin.movements.colType")}</TH>
          <TH className="text-right">{t("admin.movements.colAmount")}</TH>
          <TH>{t("admin.movements.colStatus")}</TH>
        </THeadRow>
      </thead>
      <TBody>
        {rows.map((m) => (
          <TR key={m.id}>
            <TD className="text-xs text-text-muted">
              {new Date(m.timestamp).toLocaleString()}
            </TD>
            <TD>{m.type}</TD>
            <TD className="text-right font-mono">
              ${formatNumber(m.amount, { decimals: 2 })}
            </TD>
            <TD>{m.status}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
