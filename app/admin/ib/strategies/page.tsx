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
import { formatNumber } from "@/lib/utils";

interface IbStrategyRow {
  id: string;
  name: string;
  description: string;
  passiveBonusBps: number;
  tradeBonusExtraBps: number;
  isActive: boolean;
  userCount: number;
}

export default function AdminIbStrategiesPage() {
  const { t } = useI18n();
  const [strategies, setStrategies] = React.useState<IbStrategyRow[]>([]);
  const [name, setName] = React.useState("");
  const [passive, setPassive] = React.useState("20");
  const [trade, setTrade] = React.useState("0");
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);

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

  async function create() {
    if (!name.trim()) {
      toast.error(t("admin.ib.nameRequired"));
      return;
    }
    setCreating(true);
    try {
      await apiFetch("/api/admin/ib-strategies", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          passiveBonusBps: Math.round(Number(passive) || 0),
          tradeBonusExtraBps: Math.round(Number(trade) || 0),
          isActive: true,
        }),
      });
      toast.success(t("admin.ib.created"));
      setName("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.ib.yieldStrategiesTitle")}
        subtitle={t("admin.ib.yieldStrategiesHint")}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-gold" />
            {t("admin.ib.createTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs uppercase text-text-muted">
              {t("admin.ib.name")}
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase text-text-muted">
              {t("admin.ib.passiveBonusBps")}
            </label>
            <Input
              className="w-28"
              value={passive}
              onChange={(e) => setPassive(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase text-text-muted">
              {t("admin.ib.tradeBonusBps")}
            </label>
            <Input
              className="w-28"
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
            />
          </div>
          <Button variant="primary" size="sm" loading={creating} onClick={() => void create()}>
            <Save className="h-4 w-4" />
            {t("admin.ib.createCta")}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-gold" />
            {t("admin.ib.listTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-text-muted">{t("common.loading")}</p>
          ) : strategies.length === 0 ? (
            <p className="text-sm text-text-muted">{t("admin.ib.empty")}</p>
          ) : (
            strategies.map((s) => (
              <div
                key={s.id}
                className="flex justify-between rounded-md border border-border-subtle px-3 py-2"
              >
                <div>
                  <p className="font-medium">
                    {s.name}{" "}
                    <Badge variant={s.isActive ? "success" : "default"}>
                      {s.isActive ? t("admin.ib.active") : t("admin.ib.inactive")}
                    </Badge>
                  </p>
                  <p className="font-mono text-xs text-text-muted">
                    +{formatNumber(s.passiveBonusBps / 100, { decimals: 2 })}%/day ·{" "}
                    {t("admin.ib.userCount", { n: String(s.userCount) })}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
