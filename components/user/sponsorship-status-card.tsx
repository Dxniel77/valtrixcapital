"use client";

import * as React from "react";
import { Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { apiFetch, fetchCurrentUser } from "@/lib/api/client";
import { formatNumber } from "@/lib/utils";

interface SponsorshipPeriod {
  amount: number;
  startDate: string;
  endDate: string;
  status: string;
  remainingDays: number;
  ruleLabel: string | null;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "outline"> = {
  ACTIVE: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "danger",
  RENEWED: "outline",
  SUSPENDED: "danger",
};

export function SponsorshipStatusCard() {
  const { t } = useI18n();
  const backend = useBackendAvailable();
  const [accountGranted, setAccountGranted] = React.useState(false);
  const [period, setPeriod] = React.useState<SponsorshipPeriod | null>(null);

  React.useEffect(() => {
    if (!backend) {
      setAccountGranted(false);
      setPeriod(null);
      return;
    }
    void fetchCurrentUser()
      .then((data) => {
        const granted = data.user?.accountGranted ?? false;
        setAccountGranted(granted);
        if (!granted) {
          setPeriod(null);
          return;
        }
        return apiFetch<{ period: SponsorshipPeriod | null }>("/api/sponsorship/me");
      })
      .then((data) => {
        if (data) setPeriod(data.period);
      })
      .catch(() => setPeriod(null));
  }, [backend]);

  if (!accountGranted || !period) return null;

  const progress =
    period.remainingDays > 0
      ? Math.min(
          100,
          Math.round(
            ((new Date(period.endDate).getTime() -
              new Date(period.startDate).getTime() -
              period.remainingDays * 86400000) /
              (new Date(period.endDate).getTime() -
                new Date(period.startDate).getTime())) *
              100,
          ),
        )
      : 100;

  return (
    <Card className="border-gold/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-gold" />
          {t("sponsorshipStatus.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[period.status] ?? "outline"}>
            {period.status.replace(/_/g, " ")}
          </Badge>
          {period.ruleLabel ? (
            <span className="text-xs text-text-muted">{period.ruleLabel}</span>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold text-gold">{period.remainingDays}</p>
            <p className="text-xs text-text-muted">{t("sponsorshipStatus.daysLeft")}</p>
          </div>
          <div className="text-right text-xs text-text-secondary">
            <p className="flex items-center justify-end gap-1">
              <Clock className="h-3 w-3" />
              {new Date(period.endDate).toLocaleDateString()}
            </p>
            <p className="mt-1">
              ${formatNumber(period.amount, { decimals: 0 })} USDT
            </p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-bg-hover">
          <div
            className="h-full rounded-full bg-gold transition-all"
            style={{ width: `${100 - progress}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
