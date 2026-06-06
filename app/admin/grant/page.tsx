"use client";

import * as React from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore } from "@/lib/admin/store";
import {
  DEFAULT_WITHDRAWAL_RULE,
  type WithdrawalRuleMode,
} from "@/lib/admin/withdrawal-eligibility";

export default function AdminGrantPage() {
  const { t } = useI18n();
  const grantAccount = useAdminStore((s) => s.grantAccount);

  const [wallet, setWallet] = React.useState("");
  const [alias, setAlias] = React.useState("");
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

  function submit() {
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet.trim())) {
      toast.error(t("admin.grant.invalidWallet"));
      return;
    }
    if (!alias.trim()) {
      toast.error(t("admin.grant.invalidAlias"));
      return;
    }
    grantAccount({
      wallet: wallet.trim(),
      alias: alias.trim(),
      rule: {
        mode,
        directSalesMin: Number(directMin) || 0,
        level1VolumeMin: Number(l1Min) || 0,
        level2VolumeMin: Number(l2Min) || 0,
      },
    });
    toast.success(t("admin.grant.success"));
    setWallet("");
    setAlias("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.grant.title")}
        subtitle={t("admin.grant.subtitle")}
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-gold" />
            {t("admin.grant.formTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={t("admin.grant.walletLabel")}>
            <Input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x…"
              className="font-mono"
            />
          </Field>
          <Field label={t("admin.grant.aliasLabel")}>
            <Input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={t("admin.grant.aliasPlaceholder")}
            />
          </Field>

          <Field label={t("admin.grant.modeLabel")}>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["direct_sales", t("admin.grant.modeDirect")],
                  ["network_levels", t("admin.grant.modeNetwork")],
                  ["either", t("admin.grant.modeEither")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    mode === value
                      ? "border-gold/50 bg-gold/10 text-gold"
                      : "border-border-subtle text-text-secondary hover:border-border-strong"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("admin.grant.directMinLabel")}>
              <Input
                value={directMin}
                onChange={(e) => setDirectMin(e.target.value)}
                inputMode="decimal"
                className="font-mono"
              />
            </Field>
            <Field label={t("admin.grant.l1MinLabel")}>
              <Input
                value={l1Min}
                onChange={(e) => setL1Min(e.target.value)}
                inputMode="decimal"
                className="font-mono"
              />
            </Field>
            <Field label={t("admin.grant.l2MinLabel")}>
              <Input
                value={l2Min}
                onChange={(e) => setL2Min(e.target.value)}
                inputMode="decimal"
                className="font-mono"
              />
            </Field>
          </div>

          <p className="text-xs text-text-muted">{t("admin.grant.hint")}</p>

          <Button variant="primary" size="md" onClick={submit}>
            {t("admin.grant.submit")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs uppercase tracking-wider text-text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
