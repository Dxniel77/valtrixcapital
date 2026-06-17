"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Eye, Pencil, Search } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
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
  useAdminStore,
  type AdminUser,
  type BalanceAdjustmentTarget,
  type RegistrationSource,
} from "@/lib/admin/store";
import {
  billingPeriodTotal,
  computeUserBilling,
  type LeaderPeriod,
} from "@/lib/admin/analytics";
import { exportUsersBillingCsv } from "@/lib/admin/exports";
import { cn, formatNumber, shortenAddress } from "@/lib/utils";
import {
  adminAdjustBalance,
  fetchAdminUsers,
  fetchBackendHealth,
} from "@/lib/api/client";
import { getReferrerInfo } from "@/lib/admin/sponsor";

const PERIODS: LeaderPeriod[] = ["week", "month", "3months"];
type RegistrationFilter = "all" | RegistrationSource;

export default function AdminUsersPage() {
  const { t } = useI18n();
  const users = useAdminStore((s) => s.users);
  const movements = useAdminStore((s) => s.movements);
  const setUserStatus = useAdminStore((s) => s.setUserStatus);

  const [query, setQuery] = React.useState("");
  const [period, setPeriod] = React.useState<LeaderPeriod>("week");
  const [sponsoredOnly, setSponsoredOnly] = React.useState(false);
  const [registrationFilter, setRegistrationFilter] =
    React.useState<RegistrationFilter>("all");
  const [editing, setEditing] = React.useState<AdminUser | null>(null);

  const billingRows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = users.map((u) =>
      computeUserBilling(u, users, movements, period),
    );

    if (q) {
      list = list.filter(
        (r) =>
          r.user.alias.toLowerCase().includes(q) ||
          r.user.wallet.toLowerCase().includes(q),
      );
    }

    if (sponsoredOnly) {
      list = list.filter((r) => r.user.accountGranted);
    }

    if (registrationFilter !== "all") {
      list = list.filter(
        (r) => r.user.registrationSource === registrationFilter,
      );
    }

    return list.sort((a, b) => {
      const byJoined = b.user.joinedAt - a.user.joinedAt;
      if (byJoined !== 0) return byJoined;
      return billingPeriodTotal(b) - billingPeriodTotal(a);
    });
  }, [users, movements, period, query, sponsoredOnly, registrationFilter]);

  const periodLabel = (p: LeaderPeriod) => {
    if (p === "week") return t("admin.leaders.week");
    if (p === "month") return t("admin.leaders.month");
    return t("admin.leaders.threeMonths");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.users.title")}
        subtitle={t("admin.users.subtitleBilling")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportUsersBillingCsv(billingRows, period)}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("admin.users.searchPlaceholder")}
                className="w-full pl-8 sm:w-64"
              />
            </div>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border-subtle bg-bg-base/60 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-xs transition-colors",
                period === p
                  ? "bg-gold/15 text-gold"
                  : "text-text-secondary hover:bg-bg-hover",
              )}
            >
              {periodLabel(p)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSponsoredOnly((v) => !v)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs transition-colors",
            sponsoredOnly
              ? "border-warning/50 bg-warning/10 text-warning"
              : "border-border-subtle text-text-secondary hover:bg-bg-hover",
          )}
        >
          {t("admin.users.sponsoredOnly")}
        </button>
        <div className="inline-flex rounded-md border border-border-subtle bg-bg-base/60 p-0.5">
          {(
            [
              ["all", "registrationFilterAll"],
              ["referral", "registrationFilterReferral"],
              ["direct", "registrationFilterDirect"],
            ] as const
          ).map(([key, labelKey]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRegistrationFilter(key)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-xs transition-colors",
                registrationFilter === key
                  ? "bg-gold/15 text-gold"
                  : "text-text-secondary hover:bg-bg-hover",
              )}
            >
              {t(`admin.users.${labelKey}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <thead>
            <THeadRow>
              <TH>#</TH>
              <TH>{t("admin.users.colUser")}</TH>
              <TH>{t("admin.users.colRegistration")}</TH>
              <TH>{t("admin.users.colReferredBy")}</TH>
              <TH className="text-right">{t("admin.users.colDirectRefs")}</TH>
              <TH className="text-right">{t("admin.leaders.colOperational")}</TH>
              <TH className="text-right">{t("admin.leaders.colNetwork")}</TH>
              <TH className="text-right">{t("admin.leaders.colPassive")}</TH>
              {Array.from({ length: 8 }, (_, i) => (
                <TH key={i} className="text-right">
                  L{i + 1}
                </TH>
              ))}
              <TH className="text-right">
                <span className="text-gold">{t("admin.leaders.colTotal")}</span>
              </TH>
              <TH>{t("admin.users.colStatus")}</TH>
              <TH className="text-right">{t("admin.users.colActions")}</TH>
            </THeadRow>
          </thead>
          <TBody>
            {billingRows.map((row, idx) => {
              const u = row.user;
              const sponsored = u.accountGranted;
              const referrer = getReferrerInfo(u, users);
              return (
                <TR
                  key={u.id}
                  className={cn(
                    sponsored && "bg-warning/[0.06] hover:bg-warning/[0.09]",
                  )}
                >
                  <TD className="font-mono text-xs text-text-muted">{idx + 1}</TD>
                  <TD>
                    <p className="font-medium text-text-primary">
                      {u.alias}
                      {u.role === "ADMIN" ? (
                        <Badge variant="gold" className="ml-2">
                          {t("admin.users.adminBadge")}
                        </Badge>
                      ) : null}
                      {sponsored ? (
                        <Badge variant="warning" className="ml-2">
                          {t("admin.users.sponsoredBadge")}
                        </Badge>
                      ) : null}
                    </p>
                    <p className="font-mono text-xs text-text-muted">
                      {shortenAddress(u.wallet)}
                    </p>
                  </TD>
                  <TD>
                    <Badge
                      variant={
                        u.registrationSource === "referral" ? "gold" : "outline"
                      }
                    >
                      {u.registrationSource === "referral"
                        ? t("admin.users.registrationReferral")
                        : t("admin.users.registrationDirect")}
                    </Badge>
                  </TD>
                  <TD>
                    {referrer ? (
                      <div>
                        {referrer.adminUserId ? (
                          <Link
                            href={`/admin/users/${referrer.adminUserId}`}
                            className="text-sm font-medium text-gold hover:underline"
                          >
                            {referrer.displayName}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium text-text-primary">
                            {referrer.displayName}
                          </p>
                        )}
                        <p className="font-mono text-xs text-text-muted">
                          {shortenAddress(referrer.wallet)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">
                        {t("admin.users.referredByNone")}
                      </span>
                    )}
                  </TD>
                  <TD className="text-right font-mono">{u.referrals}</TD>
                  <TD className="text-right font-mono text-xs">
                    ${formatNumber(row.operational, { decimals: 0 })}
                  </TD>
                  <TD className="text-right font-mono text-xs">
                    ${formatNumber(row.network, { decimals: 0 })}
                  </TD>
                  <TD className="text-right font-mono text-xs">
                    ${formatNumber(row.passive, { decimals: 0 })}
                  </TD>
                  {row.byLevel.map((l) => (
                    <TD key={l.level} className="text-right font-mono text-xs text-text-muted">
                      ${formatNumber(l.amount, { decimals: 0 })}
                    </TD>
                  ))}
                  <TD className="text-right font-mono font-medium text-gold">
                    ${formatNumber(billingPeriodTotal(row), { decimals: 0 })}
                  </TD>
                  <TD>
                    <Badge variant={u.status === "ACTIVE" ? "success" : "default"}>
                      {u.status === "ACTIVE"
                        ? t("admin.users.active")
                        : t("admin.users.inactive")}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/users/${u.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(u)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={u.status === "ACTIVE" ? "outline" : "primary"}
                        size="sm"
                        onClick={() => {
                          setUserStatus(
                            u.id,
                            u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                          );
                          toast.success(t("admin.users.statusUpdated"));
                        }}
                      >
                        {u.status === "ACTIVE"
                          ? t("admin.users.deactivate")
                          : t("admin.users.activate")}
                      </Button>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      <AdjustBalanceModal user={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function AdjustBalanceModal({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const adjustBalance = useAdminStore((s) => s.adjustBalance);
  const [deltaStr, setDeltaStr] = React.useState("");
  const [note, setNote] = React.useState("");
  const [target, setTarget] =
    React.useState<BalanceAdjustmentTarget>("WITHDRAWABLE");

  React.useEffect(() => {
    if (user) {
      setDeltaStr("");
      setNote("");
      setTarget("WITHDRAWABLE");
    }
  }, [user]);

  const delta = Number(deltaStr.replace(/,/g, "."));
  const stakingInvalid = target === "STAKING" && delta <= 0;
  const valid = Number.isFinite(delta) && delta !== 0 && !stakingInvalid;
  const [submitting, setSubmitting] = React.useState(false);

  async function apply() {
    if (!user || !valid || submitting) return;
    setSubmitting(true);
    try {
      const health = await fetchBackendHealth();
      if (health.database) {
        const { users: dbUsers } = await fetchAdminUsers();
        const dbUser = dbUsers.find(
          (u) => u.walletAddress.toLowerCase() === user.wallet.toLowerCase(),
        );
        if (dbUser) {
          const result = await adminAdjustBalance(
            dbUser.id,
            delta,
            note,
            target,
          );
          useAdminStore.setState((s) => ({
            users: s.users.map((u) =>
              u.wallet.toLowerCase() === user.wallet.toLowerCase()
                ? {
                    ...u,
                    balance: result.user.earningsBalance,
                    capital: result.user.lockedCapital,
                  }
                : u,
            ),
          }));
          useAdminStore.getState().mergeUsersFromBackend(dbUsers);
          toast.success(t("admin.users.balanceAdjusted"));
          onClose();
          return;
        }
      }

      adjustBalance(user.id, delta, note, target);
      toast.success(t("admin.users.balanceAdjusted"));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.users.adjustTitle")}</DialogTitle>
          <DialogDescription>
            {user
              ? t("admin.users.adjustSubtitleFull", {
                  user: user.alias,
                  balance: formatNumber(user.balance, { decimals: 2 }),
                  capital: formatNumber(user.capital, { decimals: 2 }),
                })
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.users.adjustTargetLabel")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["WITHDRAWABLE", "adjustTargetWithdrawable", "adjustTargetWithdrawableDesc"],
                  ["STAKING", "adjustTargetStaking", "adjustTargetStakingDesc"],
                ] as const
              ).map(([value, titleKey, descKey]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTarget(value)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    target === value
                      ? "border-gold/50 bg-gold/10"
                      : "border-border-subtle hover:bg-bg-hover",
                  )}
                >
                  <p className="text-sm font-medium text-text-primary">
                    {t(`admin.users.${titleKey}`)}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {t(`admin.users.${descKey}`)}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.users.deltaLabel")}
            </label>
            <Input
              value={deltaStr}
              onChange={(e) => setDeltaStr(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 100 / -50"
              className="font-mono"
            />
            <p className="text-xs text-text-muted">
              {target === "STAKING"
                ? t("admin.users.deltaHintStaking")
                : t("admin.users.deltaHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.users.noteLabel")}
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("admin.users.notePlaceholder")}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="md" onClick={onClose}>
            {t("admin.users.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={() => void apply()} disabled={!valid || submitting}>
            {t("admin.users.applyAdjust")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
