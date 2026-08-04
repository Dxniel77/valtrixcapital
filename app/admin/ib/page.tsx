"use client";

import * as React from "react";
import { toast } from "sonner";
import { Gauge, Plus, Save } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";
import { COMMISSION_RATES_BPS, REFERRAL_LEVELS } from "@/lib/referrals/constants";
import { formatNumber } from "@/lib/utils";

interface IbStrategyRow {
  id: string;
  name: string;
  description: string;
  passiveBonusBps: number;
  tradeBonusExtraBps: number;
  commissionRatesBps: number[] | null;
  isActive: boolean;
  userCount: number;
}

type Draft = {
  name: string;
  description: string;
  passiveBonusBps: string;
  tradeBonusExtraBps: string;
  useCustomCommissions: boolean;
  commissionPct: string[];
  isActive: boolean;
};

function emptyDraft(): Draft {
  return {
    name: "",
    description: "",
    passiveBonusBps: "20",
    tradeBonusExtraBps: "0",
    useCustomCommissions: false,
    commissionPct: COMMISSION_RATES_BPS.map((b) => String(b / 100)),
    isActive: true,
  };
}

function draftFromStrategy(s: IbStrategyRow): Draft {
  const rates = s.commissionRatesBps ?? [...COMMISSION_RATES_BPS];
  return {
    name: s.name,
    description: s.description,
    passiveBonusBps: String(s.passiveBonusBps),
    tradeBonusExtraBps: String(s.tradeBonusExtraBps),
    useCustomCommissions: s.commissionRatesBps != null,
    commissionPct: rates.map((b) => String(b / 100)),
    isActive: s.isActive,
  };
}

function parseDraft(d: Draft) {
  const passiveBonusBps = Math.max(0, Math.round(Number(d.passiveBonusBps) || 0));
  const tradeBonusExtraBps = Math.max(
    0,
    Math.round(Number(d.tradeBonusExtraBps) || 0),
  );
  const commissionRatesBps = d.useCustomCommissions
    ? d.commissionPct.map((p) => Math.round((Number(p) || 0) * 100))
    : null;
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    passiveBonusBps,
    tradeBonusExtraBps,
    commissionRatesBps,
    isActive: d.isActive,
  };
}

export default function AdminIbStrategiesPage() {
  const { t } = useI18n();
  const [strategies, setStrategies] = React.useState<IbStrategyRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [createDraft, setCreateDraft] = React.useState<Draft>(emptyDraft);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<Draft | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ ok: boolean; strategies: IbStrategyRow[] }>(
        "/api/admin/ib-strategies",
      );
      setStrategies(res.strategies);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function createStrategy() {
    const body = parseDraft(createDraft);
    if (!body.name) {
      toast.error(t("admin.ib.nameRequired"));
      return;
    }
    setCreating(true);
    try {
      await apiFetch("/api/admin/ib-strategies", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success(t("admin.ib.created"));
      setCreateDraft(emptyDraft());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function saveStrategy(id: string, draft: Draft) {
    const body = parseDraft(draft);
    if (!body.name) {
      toast.error(t("admin.ib.nameRequired"));
      return;
    }
    setSavingId(id);
    try {
      await apiFetch(`/api/admin/ib-strategies/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success(t("admin.ib.updated"));
      setEditId(null);
      setEditDraft(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.ib.title")}
        subtitle={t("admin.ib.subtitle")}
      />

      <Card className="border-gold/25 bg-gold/5">
        <CardContent className="space-y-2 p-4 text-sm text-text-secondary">
          <p>{t("admin.ib.principle")}</p>
          <p>{t("admin.ib.withdrawalNote")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-gold" />
            {t("admin.ib.createTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StrategyForm
            draft={createDraft}
            onChange={setCreateDraft}
            onSubmit={() => void createStrategy()}
            loading={creating}
            submitLabel={t("admin.ib.createCta")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-gold" />
            {t("admin.ib.listTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-text-muted">{t("common.loading")}</p>
          ) : strategies.length === 0 ? (
            <p className="text-sm text-text-muted">{t("admin.ib.empty")}</p>
          ) : (
            strategies.map((s) => {
              const editing = editId === s.id && editDraft;
              return (
                <div
                  key={s.id}
                  className="rounded-lg border border-border-subtle p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-text-primary">{s.name}</p>
                        <Badge variant={s.isActive ? "success" : "default"}>
                          {s.isActive
                            ? t("admin.ib.active")
                            : t("admin.ib.inactive")}
                        </Badge>
                        <Badge variant="outline">
                          {t("admin.ib.userCount", { n: String(s.userCount) })}
                        </Badge>
                      </div>
                      {s.description ? (
                        <p className="mt-1 text-sm text-text-secondary">
                          {s.description}
                        </p>
                      ) : null}
                      <p className="mt-2 font-mono text-xs text-text-muted">
                        {t("admin.ib.passiveBonus")}: +
                        {formatNumber(s.passiveBonusBps / 100, { decimals: 2 })}
                        %/day · {t("admin.ib.tradeBonus")}: +
                        {formatNumber(s.tradeBonusExtraBps / 100, {
                          decimals: 2,
                        })}
                        %/win
                        {s.commissionRatesBps
                          ? ` · ${t("admin.ib.customCommissions")}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (editing) {
                          setEditId(null);
                          setEditDraft(null);
                        } else {
                          setEditId(s.id);
                          setEditDraft(draftFromStrategy(s));
                        }
                      }}
                    >
                      {editing ? t("common.cancel") : t("admin.ib.edit")}
                    </Button>
                  </div>
                  {editing ? (
                    <StrategyForm
                      draft={editDraft}
                      onChange={setEditDraft}
                      onSubmit={() => void saveStrategy(s.id, editDraft)}
                      loading={savingId === s.id}
                      submitLabel={t("admin.ib.save")}
                    />
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StrategyForm({
  draft,
  onChange,
  onSubmit,
  loading,
  submitLabel,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSubmit: () => void;
  loading: boolean;
  submitLabel: string;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("admin.ib.name")}>
          <Input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder={t("admin.ib.namePlaceholder")}
          />
        </Field>
        <Field label={t("admin.ib.description")}>
          <Input
            value={draft.description}
            onChange={(e) =>
              onChange({ ...draft, description: e.target.value })
            }
            placeholder={t("admin.ib.descriptionPlaceholder")}
          />
        </Field>
        <Field label={t("admin.ib.passiveBonusBps")}>
          <Input
            inputMode="numeric"
            value={draft.passiveBonusBps}
            onChange={(e) =>
              onChange({ ...draft, passiveBonusBps: e.target.value })
            }
          />
          <p className="text-[11px] text-text-muted">
            {t("admin.ib.passiveBonusHint")}
          </p>
        </Field>
        <Field label={t("admin.ib.tradeBonusBps")}>
          <Input
            inputMode="numeric"
            value={draft.tradeBonusExtraBps}
            onChange={(e) =>
              onChange({ ...draft, tradeBonusExtraBps: e.target.value })
            }
          />
          <p className="text-[11px] text-text-muted">
            {t("admin.ib.tradeBonusHint")}
          </p>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={draft.useCustomCommissions}
          onChange={(e) =>
            onChange({ ...draft, useCustomCommissions: e.target.checked })
          }
        />
        {t("admin.ib.useCustomCommissions")}
      </label>

      {draft.useCustomCommissions ? (
        <div className="grid gap-2 sm:grid-cols-4">
          {Array.from({ length: REFERRAL_LEVELS }, (_, i) => (
            <Field key={i} label={t("admin.ib.levelRate", { n: String(i + 1) })}>
              <Input
                inputMode="decimal"
                value={draft.commissionPct[i] ?? ""}
                onChange={(e) => {
                  const next = [...draft.commissionPct];
                  next[i] = e.target.value;
                  onChange({ ...draft, commissionPct: next });
                }}
              />
            </Field>
          ))}
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(e) => onChange({ ...draft, isActive: e.target.checked })}
        />
        {t("admin.ib.active")}
      </label>

      <Button variant="primary" size="sm" loading={loading} onClick={onSubmit}>
        <Save className="h-4 w-4" />
        {submitLabel}
      </Button>
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
