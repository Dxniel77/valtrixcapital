"use client";

import * as React from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { apiFetch } from "@/lib/api/client";
import { COPY_NETWORK_LEVELS } from "@/lib/copy-trading/performance-fee-network";
import {
  COPY_INCOME_PERIODS,
  type CopyIncomePeriod,
} from "@/lib/copy-trading/income-period";
import { useI18n } from "@/lib/i18n/context";
import { downloadCsv } from "@/lib/ledger";
import { formatNumber } from "@/lib/utils";

type Totals = {
  platformFees: number;
  performanceFees: number;
  copyInOutFees: number;
  networkPaid: number;
  networkByLevel: number[];
  unfilledLevelRetained: number;
  companyPerfFeeShare: number;
  companyKept: number;
  totalIncome: number;
  grossPositive: number;
  grossNegative: number;
  netGross: number;
  deposits: number;
  opsClosed: number;
};

type Snapshot = {
  connectedCapital: number;
  copierPrincipal: number;
  copierPnl: number;
  activeCopies: number;
};

type Payload = {
  period: CopyIncomePeriod;
  from: string | null;
  to: string;
  generatedAt: string;
  networkRatesBps: number[];
  snapshot: Snapshot;
  totals: Totals;
  buckets: Array<Totals & { bucket: string }>;
  traders: Array<Totals & { traderId: string; traderName: string }>;
};

function money(value: number, signed = false) {
  const abs = `$${formatNumber(Math.abs(value), { decimals: 2 })}`;
  if (!signed) return value < 0 ? `-${abs}` : abs;
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function levelPct(bps: number | undefined) {
  return ((bps ?? 0) / 100).toFixed(2);
}

export default function AdminCopyIncomePage() {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<CopyIncomePeriod>("ALL");
  const [data, setData] = React.useState<Payload | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(
    async (nextPeriod: CopyIncomePeriod) => {
      setLoading(true);
      try {
        const next = await apiFetch<Payload & { ok: boolean }>(
          `/api/admin/copy/income?period=${nextPeriod}`,
        );
        setData(next);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("errors.signInFailed"),
        );
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  React.useEffect(() => {
    void load(period);
  }, [load, period]);

  function exportCsv() {
    if (!data) return;
    const levelHeaders = Array.from(
      { length: COPY_NETWORK_LEVELS },
      (_, index) => `networkL${index + 1}`,
    );
    const header = [
      "bucket",
      "platformFees",
      "performanceFees",
      "copyInOutFees",
      "networkPaid",
      ...levelHeaders,
      "unfilledLevelRetained",
      "companyPerfFeeShare",
      "companyKept",
      "totalIncome",
      "grossPositive",
      "grossNegative",
      "opsClosed",
      "deposits",
    ];
    const line = (label: string, row: Totals) =>
      [
        label,
        row.platformFees,
        row.performanceFees,
        row.copyInOutFees,
        row.networkPaid,
        ...Array.from(
          { length: COPY_NETWORK_LEVELS },
          (_, index) => row.networkByLevel[index] ?? 0,
        ),
        row.unfilledLevelRetained,
        row.companyPerfFeeShare,
        row.companyKept,
        row.totalIncome,
        row.grossPositive,
        row.grossNegative,
        row.opsClosed,
        row.deposits,
      ]
        .map(csvCell)
        .join(",");

    const lines = [
      header.join(","),
      ...data.buckets.map((row) => line(row.bucket, row)),
      "",
      ["trader", ...header.slice(1)].join(","),
      ...data.traders.map((row) => line(row.traderName, row)),
      "",
      "snapshot,connectedCapital,copierPrincipal,copierPnl,activeCopies",
      [
        "now",
        data.snapshot.connectedCapital,
        data.snapshot.copierPrincipal,
        data.snapshot.copierPnl,
        data.snapshot.activeCopies,
      ]
        .map(csvCell)
        .join(","),
    ];
    downloadCsv(
      `copy-income-${data.period.toLowerCase()}-${data.to.slice(0, 10)}.csv`,
      lines.join("\n"),
    );
  }

  const totals = data?.totals;
  const snapshot = data?.snapshot;
  const rates = data?.networkRatesBps ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.copyTrading.incomeTitle")}
        subtitle={t("admin.copyTrading.incomeSubtitle")}
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={!data}
            onClick={exportCsv}
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {COPY_INCOME_PERIODS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={period === value ? "primary" : "outline"}
            onClick={() => setPeriod(value)}
          >
            {t(`admin.copyTrading.incomePeriod.${value}`)}
          </Button>
        ))}
      </div>

      {data?.from || data?.to ? (
        <p className="text-xs text-text-muted">
          {t("admin.copyTrading.incomeRange", {
            from: data.from
              ? new Date(data.from).toISOString().slice(0, 10)
              : "—",
            to: new Date(data.to).toISOString().slice(0, 10),
          })}
        </p>
      ) : null}

      {loading && !data ? (
        <p className="py-12 text-center text-sm text-text-muted">
          {t("common.loading")}
        </p>
      ) : !totals || !snapshot ? (
        <p className="text-sm text-text-muted">{t("errors.signInFailed")}</p>
      ) : (
        <>
          <section className="space-y-3">
            <SectionHeading
              title={t("admin.copyTrading.earningsPeriodTitle")}
              hint={t("admin.copyTrading.earningsPeriodHint")}
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric
                label={t("admin.copyTrading.perfFeeGenerated")}
                value={money(totals.performanceFees)}
                tone="gold"
              />
              <Metric
                label={t("admin.copyTrading.networkCommissionsPaid")}
                value={money(totals.networkPaid)}
              />
              <Metric
                label={t("admin.copyTrading.unfilledLevels")}
                value={money(totals.unfilledLevelRetained)}
                hint={t("admin.copyTrading.unfilledLevelsHint")}
                tone="gold"
              />
              <Metric
                label={t("admin.copyTrading.companyNetProfit")}
                value={money(totals.companyKept)}
                hint={t("admin.copyTrading.companyNetHint")}
                tone="gold"
              />
              <Metric
                label={t("admin.copyTrading.incomePlatform")}
                value={money(totals.platformFees)}
              />
              <Metric
                label={t("admin.copyTrading.incomeCopyInOut")}
                value={money(totals.copyInOutFees)}
              />
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.perfFeeSplit")}
              </CardTitle>
              <p className="text-xs text-text-muted">
                {t("admin.copyTrading.perfFeeSplitHint")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <THeadRow>
                    <TH>{t("admin.copyTrading.networkByLevelTitle")}</TH>
                    <TH className="text-right">{t("admin.copyTrading.incomeAmount")}</TH>
                  </THeadRow>
                  <TBody>
                    {Array.from({ length: COPY_NETWORK_LEVELS }, (_, index) => (
                      <TR key={index}>
                        <TD className="font-medium">
                          {t("admin.copyTrading.networkLevelPct", {
                            level: index + 1,
                            pct: levelPct(rates[index]),
                          })}
                        </TD>
                        <TD className="text-right font-mono">
                          {money(totals.networkByLevel[index] ?? 0)}
                        </TD>
                      </TR>
                    ))}
                    <TR>
                      <TD className="font-medium">
                        {t("admin.copyTrading.unfilledLevels")}
                      </TD>
                      <TD className="text-right font-mono text-gold">
                        {money(totals.unfilledLevelRetained)}
                      </TD>
                    </TR>
                    <TR>
                      <TD className="font-medium">
                        {t("admin.copyTrading.companyPerfFeeShare")}
                      </TD>
                      <TD className="text-right font-mono text-gold">
                        {money(totals.companyPerfFeeShare)}
                      </TD>
                    </TR>
                    <TR>
                      <TD className="font-medium">
                        {t("admin.copyTrading.perfFeeGenerated")}
                      </TD>
                      <TD className="text-right font-mono text-gold">
                        {money(totals.performanceFees)}
                      </TD>
                    </TR>
                  </TBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <SectionHeading
              title={t("admin.copyTrading.snapshotTitle")}
              hint={t("admin.copyTrading.snapshotHint")}
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric
                label={t("admin.copyTrading.connectedCapital")}
                value={money(snapshot.connectedCapital)}
                tone="gold"
              />
              <Metric
                label={t("admin.copyTrading.copierGains")}
                value={money(snapshot.copierPnl, true)}
                hint={t("admin.copyTrading.copierGainsHint")}
                tone={snapshot.copierPnl >= 0 ? "positive" : "negative"}
              />
              <Metric
                label={t("admin.copyTrading.activeCopies")}
                value={String(snapshot.activeCopies)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeading
              title={t("admin.copyTrading.periodActivity")}
              hint={t("admin.copyTrading.periodActivityHint")}
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label={t("admin.copyTrading.liveNetGross")}
                value={money(totals.netGross, true)}
                tone={totals.netGross >= 0 ? "positive" : "negative"}
              />
              <Metric
                label={t("admin.copyTrading.incomeOpsClosed")}
                value={String(totals.opsClosed)}
              />
              <Metric
                label={t("admin.copyTrading.liveRealDeposits")}
                value={money(totals.deposits)}
                tone="positive"
              />
              <Metric
                label={t("admin.copyTrading.liveTotalIncome")}
                value={money(totals.totalIncome)}
                tone="gold"
              />
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.incomeByPeriod")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.buckets.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">
                  {t("admin.copyTrading.incomeEmpty")}
                </p>
              ) : (
                <IncomeTable
                  rates={rates}
                  rows={data.buckets.map((row) => ({
                    label: row.bucket,
                    ...row,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.incomeByTrader")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.traders.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">
                  {t("admin.copyTrading.incomeEmpty")}
                </p>
              ) : (
                <IncomeTable
                  rates={rates}
                  rows={data.traders.map((row) => ({
                    label: row.traderName,
                    href: `/admin/copy-trading/${row.traderId}`,
                    ...row,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      <p className="text-xs text-text-muted">{hint}</p>
    </div>
  );
}

function IncomeTable({
  rows,
  rates,
}: {
  rates: number[];
  rows: Array<
    Totals & {
      label: string;
      href?: string;
    }
  >;
}) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto">
      <Table>
        <THeadRow>
          <TH>{t("admin.copyTrading.incomeBucket")}</TH>
          <TH className="text-right">
            {t("admin.copyTrading.livePerformanceFeeCol")}
          </TH>
          {Array.from({ length: COPY_NETWORK_LEVELS }, (_, index) => (
            <TH key={index} className="text-right">
              {t("admin.copyTrading.networkLevelPct", {
                level: index + 1,
                pct: levelPct(rates[index]),
              })}
            </TH>
          ))}
          <TH className="text-right">{t("admin.copyTrading.unfilledShort")}</TH>
          <TH className="text-right">{t("admin.copyTrading.liveCompanyKept")}</TH>
        </THeadRow>
        <TBody>
          {rows.map((row) => (
            <TR key={row.label}>
              <TD className="font-medium">
                {row.href ? (
                  <Link href={row.href} className="hover:text-gold">
                    {row.label}
                  </Link>
                ) : (
                  row.label
                )}
              </TD>
              <TD className="text-right font-mono text-gold">
                {money(row.performanceFees)}
              </TD>
              {Array.from({ length: COPY_NETWORK_LEVELS }, (_, index) => (
                <TD key={index} className="text-right font-mono">
                  {money(row.networkByLevel[index] ?? 0)}
                </TD>
              ))}
              <TD className="text-right font-mono text-gold">
                {money(row.unfilledLevelRetained)}
              </TD>
              <TD className="text-right font-mono text-gold">
                {money(row.companyKept)}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
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
        {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
