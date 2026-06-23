"use client";

import * as React from "react";
import { toast } from "sonner";
import { RotateCcw, Save } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { usePlatformSettings } from "@/lib/platform/settings-store";
import { savePlatformSettingsToBackend } from "@/lib/platform/config-sync";
import { PAIRS } from "@/lib/market/pairs";
import { cn } from "@/lib/utils";

export default function AdminSettingsPage() {
  const { t } = useI18n();
  const settings = usePlatformSettings();
  const [saving, setSaving] = React.useState(false);

  const [draft, setDraft] = React.useState(settings);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    setDraft(settings);
    setDirty(false);
  }, [settings]);

  function patch(p: Partial<typeof draft>) {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  }

  function num(v: string): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function togglePair(binance: string) {
    const has = draft.allowedPairs.includes(binance);
    patch({
      allowedPairs: has
        ? draft.allowedPairs.filter((p) => p !== binance)
        : [...draft.allowedPairs, binance],
    });
  }

  async function save() {
    setSaving(true);
    try {
      const health = await import("@/lib/api/client").then((m) =>
        m.fetchBackendHealth(),
      );
      if (health.database) {
        await savePlatformSettingsToBackend(draft);
      } else {
        const { useAdminStore } = await import("@/lib/admin/store");
        useAdminStore.getState().updateSettings(draft);
      }
      toast.success(t("admin.settings.saved"));
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.settings.title")}
        subtitle={t("admin.settings.subtitle")}
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setDraft(settings);
                setDirty(false);
              }}
              disabled={!dirty}
            >
              <RotateCcw className="h-4 w-4" /> {t("admin.settings.reset")}
            </Button>
            <Button variant="primary" size="md" onClick={() => void save()} disabled={!dirty || saving} loading={saving}>
              <Save className="h-4 w-4" /> {t("admin.settings.save")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.settings.yieldTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label={t("admin.settings.baseYield")}
              suffix={`${(draft.baseYieldBps / 100).toFixed(2)}%`}
            >
              <Input
                inputMode="numeric"
                value={String(draft.baseYieldBps)}
                onChange={(e) => patch({ baseYieldBps: num(e.target.value) })}
                className="font-mono"
              />
            </Field>
            <Field
              label={t("admin.settings.bonusPerWin")}
              suffix={`${(draft.bonusPerWinBps / 100).toFixed(2)}%`}
            >
              <Input
                inputMode="numeric"
                value={String(draft.bonusPerWinBps)}
                onChange={(e) => patch({ bonusPerWinBps: num(e.target.value) })}
                className="font-mono"
              />
            </Field>
            <Field
              label={t("admin.settings.maxDaily")}
              suffix={`${(draft.maxDailyYieldBps / 100).toFixed(2)}%`}
            >
              <Input
                inputMode="numeric"
                value={String(draft.maxDailyYieldBps)}
                onChange={(e) => patch({ maxDailyYieldBps: num(e.target.value) })}
                className="font-mono"
              />
            </Field>
            <p className="text-xs text-text-muted">{t("admin.settings.bpsHint")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.settings.feesTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label={t("admin.settings.withdrawalFee")}
              suffix={`${(draft.withdrawalFeeBps / 100).toFixed(2)}%`}
            >
              <Input
                inputMode="numeric"
                value={String(draft.withdrawalFeeBps)}
                onChange={(e) => patch({ withdrawalFeeBps: num(e.target.value) })}
                className="font-mono"
              />
            </Field>
            <Field label={t("admin.settings.minWithdrawal")} suffix="USDT">
              <Input
                inputMode="numeric"
                value={String(draft.minWithdrawalUsdt)}
                onChange={(e) => patch({ minWithdrawalUsdt: num(e.target.value) })}
                className="font-mono"
              />
            </Field>
            <Field label={t("admin.settings.minStake")} suffix="USDT">
              <Input
                inputMode="numeric"
                value={String(draft.minStakeUsdt)}
                onChange={(e) => patch({ minStakeUsdt: num(e.target.value) })}
                className="font-mono"
              />
            </Field>
            <Field label={t("admin.settings.maxStake")} suffix="USDT">
              <Input
                inputMode="numeric"
                value={String(draft.maxStakeUsdt)}
                onChange={(e) => patch({ maxStakeUsdt: num(e.target.value) })}
                className="font-mono"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.settings.commissionsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {draft.commissionRatesBps.map((bps, i) => (
                <div key={i} className="space-y-1">
                  <label className="text-xs text-text-muted">
                    {t("referrals.level", { n: i + 1 })}
                  </label>
                  <Input
                    inputMode="numeric"
                    value={String(bps)}
                    onChange={(e) => {
                      const next = [...draft.commissionRatesBps];
                      next[i] = num(e.target.value);
                      patch({ commissionRatesBps: next });
                    }}
                    className="font-mono text-sm"
                  />
                  <span className="text-[10px] text-text-muted">
                    {(bps / 100).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{t("admin.settings.pairsTitle")}</CardTitle>
              <Badge variant="default">
                {draft.allowedPairs.length}/{PAIRS.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PAIRS.map((p) => {
                const on = draft.allowedPairs.includes(p.binance);
                return (
                  <button
                    key={p.binance}
                    type="button"
                    onClick={() => togglePair(p.binance)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm font-mono transition-colors",
                      on
                        ? "border-gold/50 bg-gold/10 text-gold"
                        : "border-border-subtle bg-bg-base/60 text-text-muted hover:text-text-secondary",
                    )}
                  >
                    {p.base}/USDT
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  suffix,
  children,
}: {
  label: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase tracking-wider text-text-muted">
          {label}
        </label>
        {suffix ? (
          <span className="font-mono text-xs text-gold">{suffix}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
