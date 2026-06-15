"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Check,
  GitBranch,
  Info,
  Network,
  RotateCcw,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore } from "@/lib/admin/store";
import {
  DEFAULT_WITHDRAWAL_RULE,
  type WithdrawalRule,
  type WithdrawalRuleMode,
} from "@/lib/admin/withdrawal-eligibility";
import {
  buildVolumeProgressItems,
  progressItemsForUser,
  volumesFromAdminUser,
} from "@/lib/admin/withdrawal-progress";
import { WithdrawalVolumeProgress } from "@/components/admin/withdrawal-volume-progress";
import { cn, formatNumber, shortenAddress } from "@/lib/utils";

const MODES: {
  value: WithdrawalRuleMode;
  icon: React.ElementType;
  labelKey: string;
  descKey: string;
}[] = [
  {
    value: "direct_sales",
    icon: TrendingUp,
    labelKey: "admin.grant.modeDirect",
    descKey: "admin.grant.modeDirectDesc",
  },
  {
    value: "network_levels",
    icon: Network,
    labelKey: "admin.grant.modeNetwork",
    descKey: "admin.grant.modeNetworkDesc",
  },
  {
    value: "either",
    icon: GitBranch,
    labelKey: "admin.grant.modeEither",
    descKey: "admin.grant.modeEitherDesc",
  },
];

function isValidWallet(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v.trim());
}

function ruleSummary(
  rule: WithdrawalRule,
  t: (k: string, v?: Record<string, string | number>) => string,
): string {
  if (rule.mode === "direct_sales") {
    return t("admin.grant.previewDirect", {
      amount: formatNumber(rule.directSalesMin, { decimals: 0 }),
    });
  }
  if (rule.mode === "network_levels") {
    return t("admin.grant.previewNetwork", {
      l1: formatNumber(rule.level1VolumeMin, { decimals: 0 }),
      l2: formatNumber(rule.level2VolumeMin, { decimals: 0 }),
    });
  }
  return t("admin.grant.previewEither", {
    direct: formatNumber(rule.directSalesMin, { decimals: 0 }),
    l1: formatNumber(rule.level1VolumeMin, { decimals: 0 }),
    l2: formatNumber(rule.level2VolumeMin, { decimals: 0 }),
  });
}

export function GrantAccountForm() {
  const { t } = useI18n();
  const grantAccount = useAdminStore((s) => s.grantAccount);
  const users = useAdminStore((s) => s.users);

  const [wallet, setWallet] = React.useState("");
  const [alias, setAlias] = React.useState("");
  const [upline, setUpline] = React.useState("");
  const [mode, setMode] = React.useState<WithdrawalRuleMode>("either");
  const [directMin, setDirectMin] = React.useState(
    String(DEFAULT_WITHDRAWAL_RULE.directSalesMin),
  );
  const [l1Min, setL1Min] = React.useState(
    String(DEFAULT_WITHDRAWAL_RULE.level1VolumeMin),
  );
  const [l2Min, setL2Min] = React.useState(
    String(DEFAULT_WITHDRAWAL_RULE.level2VolumeMin),
  );

  const walletOk = isValidWallet(wallet);
  const aliasOk = alias.trim().length >= 2;
  const uplineOk = !upline.trim() || isValidWallet(upline);
  const canSubmit = walletOk && aliasOk && uplineOk;

  const rule: WithdrawalRule = {
    mode,
    directSalesMin: Number(directMin) || 0,
    level1VolumeMin: Number(l1Min) || 0,
    level2VolumeMin: Number(l2Min) || 0,
  };

  const recentSponsored = React.useMemo(
    () =>
      users
        .filter((u) => u.accountGranted)
        .sort((a, b) => b.joinedAt - a.joinedAt)
        .slice(0, 6),
    [users],
  );

  const existingWalletUser = React.useMemo(() => {
    if (!walletOk) return null;
    const key = wallet.trim().toLowerCase();
    return users.find((u) => u.wallet.toLowerCase() === key) ?? null;
  }, [users, wallet, walletOk]);

  const previewProgressItems = React.useMemo(() => {
    const previewRule =
      existingWalletUser?.accountGranted
        ? existingWalletUser.withdrawalRule
        : rule;
    const volumes = existingWalletUser
      ? volumesFromAdminUser(existingWalletUser)
      : { direct: 0, l1: 0, l2: 0 };
    return buildVolumeProgressItems(volumes, previewRule);
  }, [existingWalletUser, rule]);

  const previewUnlocked = existingWalletUser?.withdrawalUnlocked ?? false;

  function reset() {
    setWallet("");
    setAlias("");
    setUpline("");
    setMode("either");
    setDirectMin(String(DEFAULT_WITHDRAWAL_RULE.directSalesMin));
    setL1Min(String(DEFAULT_WITHDRAWAL_RULE.level1VolumeMin));
    setL2Min(String(DEFAULT_WITHDRAWAL_RULE.level2VolumeMin));
  }

  function submit() {
    if (!walletOk) {
      toast.error(t("admin.grant.invalidWallet"));
      return;
    }
    if (!aliasOk) {
      toast.error(t("admin.grant.invalidAlias"));
      return;
    }
    if (!uplineOk) {
      toast.error(t("admin.grant.invalidUpline"));
      return;
    }
    grantAccount({
      wallet: wallet.trim(),
      alias: alias.trim(),
      uplineWallet: upline.trim() || null,
      rule,
    });
    toast.success(t("admin.grant.success"));
    reset();
  }

  const showDirect = mode === "direct_sales" || mode === "either";
  const showNetwork = mode === "network_levels" || mode === "either";

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border-subtle bg-bg-base/40 pb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{t("admin.grant.formTitle")}</CardTitle>
              <p className="mt-1 text-sm text-text-secondary">
                {t("admin.grant.formSubtitle")}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 p-6">
          <section className="space-y-4">
            <SectionHeading step={1} title={t("admin.grant.identitySection")} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("admin.grant.walletLabel")} required>
                <div className="relative">
                  <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <Input
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                    placeholder="0x…"
                    className={cn(
                      "pl-9 font-mono text-sm",
                      wallet && (walletOk ? "border-success/40" : "border-danger/40"),
                    )}
                  />
                  {walletOk ? (
                    <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
                  ) : null}
                </div>
              </Field>

              <Field label={t("admin.grant.aliasLabel")} required>
                <Input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder={t("admin.grant.aliasPlaceholder")}
                  className={cn(
                    alias && (aliasOk ? "border-success/40" : "border-danger/40"),
                  )}
                />
              </Field>
            </div>

            <Field label={t("admin.grant.uplineLabel")} hint={t("admin.grant.uplineHint")}>
              <div className="relative">
                <Network className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  value={upline}
                  onChange={(e) => setUpline(e.target.value)}
                  placeholder={t("admin.grant.uplinePlaceholder")}
                  className={cn(
                    "pl-9 font-mono text-sm",
                    upline && (uplineOk ? "border-success/40" : "border-danger/40"),
                  )}
                />
              </div>
            </Field>
          </section>

          <section className="space-y-4">
            <SectionHeading step={2} title={t("admin.grant.rulesSection")} />

            <Field label={t("admin.grant.modeLabel")}>
              <div className="grid gap-3">
                {MODES.map(({ value, icon: Icon, labelKey, descKey }) => {
                  const active = mode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-4 text-left transition-all",
                        active
                          ? "border-gold/50 bg-gold/8 shadow-[0_0_0_1px_rgba(212,175,55,0.15)]"
                          : "border-border-subtle bg-bg-base/30 hover:border-border-strong hover:bg-bg-hover/50",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                          active ? "bg-gold/20 text-gold" : "bg-bg-hover text-text-muted",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              active ? "text-gold" : "text-text-primary",
                            )}
                          >
                            {t(labelKey)}
                          </span>
                          {active ? (
                            <Badge variant="gold" className="text-[10px]">
                              {t("admin.grant.selected")}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                          {t(descKey)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <div
              className={cn(
                "grid gap-4 rounded-lg border border-border-subtle bg-bg-base/30 p-4 transition-all",
                showDirect && showNetwork ? "sm:grid-cols-3" : showNetwork ? "sm:grid-cols-2" : "sm:grid-cols-1",
              )}
            >
              {showDirect ? (
                <AmountField
                  label={t("admin.grant.directMinLabel")}
                  value={directMin}
                  onChange={setDirectMin}
                  active={mode === "direct_sales" || mode === "either"}
                />
              ) : null}
              {showNetwork ? (
                <>
                  <AmountField
                    label={t("admin.grant.l1MinLabel")}
                    value={l1Min}
                    onChange={setL1Min}
                    active={mode === "network_levels" || mode === "either"}
                  />
                  <AmountField
                    label={t("admin.grant.l2MinLabel")}
                    value={l2Min}
                    onChange={setL2Min}
                    active={mode === "network_levels" || mode === "either"}
                  />
                </>
              ) : null}
            </div>

            <div className="flex gap-2 rounded-lg border border-border-subtle/80 bg-bg-base/50 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <p className="text-xs leading-relaxed text-text-secondary">
                {t("admin.grant.hint")}
              </p>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-6">
            <Button
              variant="primary"
              size="md"
              onClick={submit}
              disabled={!canSubmit}
              className="min-w-[160px]"
            >
              <UserPlus className="h-4 w-4" />
              {t("admin.grant.submit")}
            </Button>
            <Button variant="ghost" size="md" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              {t("admin.grant.reset")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-gold/20 bg-gradient-to-b from-gold/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("admin.grant.previewTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <PreviewRow
              label={t("admin.grant.previewAlias")}
              value={alias.trim() || "—"}
            />
            <PreviewRow
              label={t("admin.grant.previewWallet")}
              value={walletOk ? shortenAddress(wallet) : wallet.trim() || "—"}
              mono
            />
            <PreviewRow
              label={t("admin.grant.previewRule")}
              value={ruleSummary(rule, t)}
            />
            <div className="border-t border-border-subtle pt-3">
              <WithdrawalVolumeProgress
                title={t("admin.grant.progressTitle")}
                items={previewProgressItems}
                unlocked={previewUnlocked}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="warning">{t("admin.users.sponsoredBadge")}</Badge>
              <Badge variant="outline">{t("admin.lookup.withdrawLocked")}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("admin.grant.recentTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSponsored.length === 0 ? (
              <p className="text-sm text-text-muted">{t("admin.grant.recentEmpty")}</p>
            ) : (
              <ul className="space-y-2">
                {recentSponsored.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="block rounded-md border border-border-subtle bg-bg-base/40 px-3 py-2.5 transition-colors hover:border-gold/30 hover:bg-gold/5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {u.alias}
                          </p>
                          <p className="font-mono text-[10px] text-text-muted">
                            {shortenAddress(u.wallet)}
                          </p>
                        </div>
                        <Badge
                          variant={u.withdrawalUnlocked ? "success" : "warning"}
                          className="shrink-0 text-[10px]"
                        >
                          {u.withdrawalUnlocked
                            ? t("admin.lookup.withdrawOk")
                            : t("admin.lookup.withdrawLocked")}
                        </Badge>
                      </div>
                      <div className="mt-2.5">
                        <WithdrawalVolumeProgress
                          items={progressItemsForUser(u)}
                          unlocked={u.withdrawalUnlocked}
                          compact
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SectionHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-gold">
        {step}
      </span>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
        {title}
      </h3>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-xs uppercase tracking-wider text-text-muted">
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-text-muted">{hint}</p> : null}
    </div>
  );
}

function AmountField({
  label,
  value,
  onChange,
  active,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  active: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", !active && "opacity-60")}>
      <label className="text-[11px] uppercase tracking-wider text-text-muted">
        {label}
      </label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          className="pr-14 font-mono"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
          USDT
        </span>
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-text-muted">{label}</span>
      <span
        className={cn(
          "text-right text-xs text-text-primary",
          mono && "font-mono",
        )}
      >
        {value}
      </span>
    </div>
  );
}
