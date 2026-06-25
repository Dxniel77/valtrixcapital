"use client";

import * as React from "react";
import { toast } from "sonner";
import { Calendar, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";
import { formatNumber } from "@/lib/utils";
import type { AdminUser } from "@/lib/admin/store";

interface SponsorshipPeriod {
  amount: number;
  startDate: string;
  endDate: string;
  status: string;
  remainingDays: number;
  ruleLabel: string | null;
}

export function AdminUserSponsorshipCard({ user }: { user: AdminUser }) {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<SponsorshipPeriod | null>(null);
  const [renewAmount, setRenewAmount] = React.useState("100");
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    const data = await apiFetch<{ period: SponsorshipPeriod | null }>(
      `/api/admin/sponsorship/users/${user.id}`,
    );
    setPeriod(data.period);
  }, [user.id]);

  React.useEffect(() => {
    if (!user.accountGranted) return;
    void load().catch(() => setPeriod(null));
  }, [user.accountGranted, load]);

  if (!user.accountGranted) return null;

  async function renew() {
    const amount = Number(renewAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setLoading(true);
    try {
      await apiFetch("/api/admin/sponsorship/renew", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, amountUsd: amount }),
      });
      toast.success(t("admin.userSponsorship.renewed"));
      await load();
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
          <Calendar className="h-4 w-4 text-gold" />
          {t("admin.userSponsorship.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {period ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t("admin.sponsorship.amount")} value={`$${formatNumber(period.amount, { decimals: 0 })}`} />
            <Stat label={t("admin.sponsorship.remaining")} value={`${period.remainingDays} ${t("admin.sponsorship.days")}`} />
            <Stat label={t("admin.sponsorship.ends")} value={new Date(period.endDate).toLocaleDateString()} />
            <div>
              <p className="text-xs uppercase tracking-wider text-text-muted">{t("admin.sponsorship.status")}</p>
              <Badge
                variant={
                  period.status === "REQUIREMENTS_MET"
                    ? "success"
                    : period.status === "REQUIREMENTS_FAILED" || period.status === "EXPIRED"
                      ? "danger"
                      : "warning"
                }
                className="mt-1"
              >
                {period.status === "REQUIREMENTS_MET"
                  ? t("admin.userSponsorship.requirementsMet")
                  : period.status === "REQUIREMENTS_FAILED"
                    ? t("admin.userSponsorship.requirementsFailed")
                    : period.status.replace(/_/g, " ")}
              </Badge>
            </div>
            {period.ruleLabel ? (
              <p className="text-xs text-text-muted sm:col-span-2">{period.ruleLabel}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-text-muted">{t("admin.userSponsorship.noPeriod")}</p>
        )}

        <div className="flex flex-wrap items-end gap-2 border-t border-border-subtle pt-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.userSponsorship.renewAmount")}
            </label>
            <Input
              value={renewAmount}
              onChange={(e) => setRenewAmount(e.target.value)}
              className="w-32"
              inputMode="decimal"
            />
          </div>
          <Button variant="primary" size="sm" onClick={() => void renew()} loading={loading}>
            <RefreshCw className="h-4 w-4" />
            {t("admin.userSponsorship.renew")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm text-text-primary">{value}</p>
    </div>
  );
}
