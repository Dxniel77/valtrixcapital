"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { apiFetch } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber, shortenAddress } from "@/lib/utils";

type Copier = {
  investmentId: string;
  userId: string;
  username: string | null;
  walletAddress: string;
  traderId: string;
  traderName: string;
  principal: number;
  currentValue: number;
  pnl: number;
  roiBps: number;
  startedAt: string;
};

type Payload = {
  total: number;
  winning: number;
  losing: number;
  principal: number;
  currentValue: number;
  pnl: number;
  copiers: Copier[];
};

type PnlFilter = "all" | "win" | "lose";

export default function AdminCopyCopiersPage() {
  const { t } = useI18n();
  const [data, setData] = React.useState<Payload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [pnlFilter, setPnlFilter] = React.useState<PnlFilter>("all");

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await apiFetch<Payload & { ok: boolean }>(
          "/api/admin/copy/copiers",
        );
        if (!cancelled) setData(next);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("errors.signInFailed"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const rows = React.useMemo(() => {
    let list = data?.copiers ?? [];
    if (pnlFilter === "win") list = list.filter((row) => row.pnl > 0);
    if (pnlFilter === "lose") list = list.filter((row) => row.pnl < 0);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (row) =>
          row.traderName.toLowerCase().includes(q) ||
          (row.username ?? "").toLowerCase().includes(q) ||
          row.walletAddress.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => b.pnl - a.pnl);
  }, [data?.copiers, pnlFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.copyTrading.copiersTitle")}
        subtitle={t("admin.copyTrading.copiersSubtitle")}
      />

      {loading ? (
        <p className="py-12 text-center text-sm text-text-muted">
          {t("common.loading")}
        </p>
      ) : !data ? (
        <p className="text-sm text-text-muted">{t("admin.copyTrading.noCopiers")}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={t("admin.copyTrading.activeCopiers")}
              value={String(data.total)}
            />
            <Metric
              label={t("admin.copyTrading.connectedCapital")}
              value={`$${formatNumber(data.currentValue, { decimals: 2 })}`}
              tone="gold"
            />
            <Metric
              label={t("admin.copyTrading.platformPnl")}
              value={`${data.pnl >= 0 ? "+" : ""}$${formatNumber(data.pnl, { decimals: 2 })}`}
              tone={data.pnl >= 0 ? "positive" : "negative"}
            />
            <Metric
              label={t("admin.copyTrading.winLose")}
              value={`${data.winning} / ${data.losing}`}
            />
          </div>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={pnlFilter}
                  onChange={(e) => setPnlFilter(e.target.value as PnlFilter)}
                >
                  <option value="all">{t("admin.copyTrading.filterAll")}</option>
                  <option value="win">{t("admin.copyTrading.filterWinning")}</option>
                  <option value="lose">{t("admin.copyTrading.filterLosing")}</option>
                </Select>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("admin.copyTrading.searchCopiers")}
                />
              </div>
              {rows.length === 0 ? (
                <p className="text-sm text-text-muted">
                  {t("admin.copyTrading.noCopiers")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <thead>
                      <THeadRow>
                        <TH>{t("common.user")}</TH>
                        <TH>{t("admin.copyTrading.trader")}</TH>
                        <TH className="text-right">
                          {t("admin.copyTrading.principal")}
                        </TH>
                        <TH className="text-right">
                          {t("admin.copyTrading.valueLabel")}
                        </TH>
                        <TH className="text-right">{t("admin.copyTrading.pnl")}</TH>
                        <TH className="text-right">{t("admin.copyTrading.roi")}</TH>
                      </THeadRow>
                    </thead>
                    <TBody>
                      {rows.map((row) => (
                        <TR key={row.investmentId}>
                          <TD>
                            <Link
                              href={`/admin/users/${row.userId}`}
                              className="hover:text-gold"
                            >
                              {row.username || shortenAddress(row.walletAddress)}
                            </Link>
                            <p className="font-mono text-xs text-text-muted">
                              {shortenAddress(row.walletAddress)}
                            </p>
                          </TD>
                          <TD>
                            <Link
                              href={`/admin/copy-trading/${row.traderId}`}
                              className="hover:text-gold"
                            >
                              {row.traderName}
                            </Link>
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
                          <TD
                            className={`text-right font-mono ${row.roiBps >= 0 ? "text-success" : "text-danger"}`}
                          >
                            {row.roiBps >= 0 ? "+" : ""}
                            {(row.roiBps / 100).toFixed(2)}%
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gold" | "positive" | "negative";
}) {
  const color =
    tone === "gold"
      ? "text-gold"
      : tone === "positive"
        ? "text-success"
        : tone === "negative"
          ? "text-danger"
          : "text-text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wider text-text-muted">
          {label}
        </p>
        <p className={`mt-1 font-mono text-xl font-semibold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
