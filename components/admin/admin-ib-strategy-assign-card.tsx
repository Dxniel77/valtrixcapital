"use client";

import * as React from "react";
import { toast } from "sonner";
import { Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IbBoostBadge } from "@/components/ib/ib-boost-badge";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";
import { formatNumber } from "@/lib/utils";
import { useAdminStore, type AdminUser } from "@/lib/admin/store";

interface IbStrategyOption {
  id: string;
  name: string;
  passiveBonusBps: number;
  tradeBonusExtraBps: number;
  isActive: boolean;
}

export function AdminIbStrategyAssignCard({ user }: { user: AdminUser }) {
  const { t } = useI18n();
  const [strategies, setStrategies] = React.useState<IbStrategyOption[]>([]);
  const [strategyId, setStrategyId] = React.useState<string>(
    user.ibStrategyId ?? "",
  );
  const [loading, setLoading] = React.useState(false);
  const [booting, setBooting] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiFetch<{
          ok: boolean;
          strategies: IbStrategyOption[];
        }>("/api/admin/ib-strategies");
        if (cancelled) return;
        setStrategies(res.strategies.filter((s) => s.isActive));
      } catch {
        /* ignore — card stays usable with empty list */
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    setStrategyId(user.ibStrategyId ?? "");
  }, [user]);

  const selected = strategies.find((s) => s.id === strategyId) ?? null;

  async function save() {
    setLoading(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        ibStrategyId: string | null;
        ibStrategy: {
          id: string;
          name: string;
          passiveBonusBps: number;
          tradeBonusExtraBps: number;
          isActive: boolean;
        } | null;
      }>(`/api/admin/users/${user.id}/ib-strategy`, {
        method: "POST",
        body: JSON.stringify({
          strategyId: strategyId.trim() ? strategyId : null,
        }),
      });
      const nextBoost =
        res.ibStrategy && res.ibStrategy.isActive
          ? {
              strategyId: res.ibStrategy.id,
              name: res.ibStrategy.name,
              passiveBonusBps: res.ibStrategy.passiveBonusBps,
              tradeBonusExtraBps: res.ibStrategy.tradeBonusExtraBps,
            }
          : null;
      setStrategyId(res.ibStrategyId ?? "");
      useAdminStore.setState((s) => ({
        users: s.users.map((u) =>
          u.id === user.id
            ? {
                ...u,
                ibStrategyId: res.ibStrategyId,
                ibBoost: nextBoost,
              }
            : u,
        ),
      }));
      toast.success(t("admin.ib.assigned"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-gold/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-gold" />
          {t("admin.ib.assignTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-text-secondary">{t("admin.ib.assignHint")}</p>
          <IbBoostBadge boost={user.ibBoost} showName />
        </div>
        <select
          className="w-full rounded-md border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary"
          value={strategyId}
          disabled={booting || loading}
          onChange={(e) => setStrategyId(e.target.value)}
        >
          <option value="">{t("admin.ib.none")}</option>
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} (+{formatNumber(s.passiveBonusBps / 100, { decimals: 2 })}
              %/day)
            </option>
          ))}
        </select>
        {selected ? (
          <p className="font-mono text-xs text-text-muted">
            {t("admin.ib.passiveBonus")}: +
            {formatNumber(selected.passiveBonusBps / 100, { decimals: 2 })}%/day
            · {t("admin.ib.tradeBonus")}: +
            {formatNumber(selected.tradeBonusExtraBps / 100, { decimals: 2 })}
            %/win
          </p>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          loading={loading}
          disabled={booting}
          onClick={() => void save()}
        >
          {t("admin.ib.assignCta")}
        </Button>
      </CardContent>
    </Card>
  );
}
