"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { apiFetch } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/utils";

type CopyRow = {
  id: string;
  traderId: string;
  traderName: string;
  status: "ACTIVE" | "CLOSED";
  principal: number;
  currentValue: number;
  pnl: number;
  roiBps: number;
  startedAt: string;
  closedAt: string | null;
};

type Payload = {
  summary: {
    active: number;
    principal: number;
    currentValue: number;
    pnl: number;
    copyCashBalance?: number;
  };
  investments: CopyRow[];
};

export function AdminUserCopyCard({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [data, setData] = React.useState<Payload | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await apiFetch<Payload & { ok: boolean }>(
          `/api/admin/copy/users/${userId}`,
        );
        if (!cancelled) setData(next);
      } catch {
        if (!cancelled) setData({
          summary: { active: 0, principal: 0, currentValue: 0, pnl: 0, copyCashBalance: 0 },
          investments: [],
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.copyTrading.userCopyTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("common.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.copyTrading.userCopyTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={t("admin.copyTrading.copyCash")}
            value={`$${formatNumber(data.summary.copyCashBalance ?? 0, { decimals: 2 })}`}
          />
          <Stat
            label={t("admin.copyTrading.copies")}
            value={String(data.summary.active)}
          />
          <Stat
            label={t("admin.copyTrading.valueLabel")}
            value={`$${formatNumber(data.summary.currentValue, { decimals: 2 })}`}
          />
          <Stat
            label={t("admin.copyTrading.pnl")}
            value={`${data.summary.pnl >= 0 ? "+" : ""}$${formatNumber(data.summary.pnl, { decimals: 2 })}`}
            tone={data.summary.pnl >= 0 ? "positive" : "negative"}
          />
        </div>
        {data.investments.length === 0 ? (
          <p className="text-sm text-text-muted">
            {t("admin.copyTrading.userCopyEmpty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <THeadRow>
                  <TH>{t("admin.copyTrading.trader")}</TH>
                  <TH>{t("admin.copyTrading.opStatus")}</TH>
                  <TH className="text-right">
                    {t("admin.copyTrading.principal")}
                  </TH>
                  <TH className="text-right">
                    {t("admin.copyTrading.valueLabel")}
                  </TH>
                  <TH className="text-right">{t("admin.copyTrading.pnl")}</TH>
                </THeadRow>
              </thead>
              <TBody>
                {data.investments.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link
                        href={`/admin/copy-trading/${row.traderId}`}
                        className="hover:text-gold"
                      >
                        {row.traderName}
                      </Link>
                    </TD>
                    <TD>
                      <Badge
                        variant={row.status === "ACTIVE" ? "success" : "outline"}
                      >
                        {row.status}
                      </Badge>
                    </TD>
                    <TD className="text-right font-mono">
                      ${formatNumber(row.principal, { decimals: 2 })}
                    </TD>
                    <TD className="text-right font-mono">
                      ${formatNumber(row.currentValue, { decimals: 2 })}
                    </TD>
                    <TD
                      className={`text-right font-mono ${row.pnl >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {row.pnl >= 0 ? "+" : ""}$
                      {formatNumber(row.pnl, { decimals: 2 })}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-md border border-border-subtle p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p
        className={`mt-1 font-mono text-sm ${
          tone === "positive"
            ? "text-success"
            : tone === "negative"
              ? "text-danger"
              : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
