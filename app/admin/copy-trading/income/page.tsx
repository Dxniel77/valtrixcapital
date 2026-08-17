"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { apiFetch } from "@/lib/api/client";
import { COPY_INCOME_PERIODS, type CopyIncomePeriod } from "@/lib/copy-trading/income-period";
import { useI18n } from "@/lib/i18n/context";
import { downloadCsv } from "@/lib/ledger";
import { formatNumber } from "@/lib/utils";

type Totals = {
  platformFees: number;
  performanceFees: number;
  copyInOutFees: number;
  networkPaid: number;
  companyKept: number;
  totalIncome: number;
  grossPositive: number;
  grossNegative: number;
  netGross: number;
  deposits: number;
  opsClosed: number;
};

type Payload = {
  period: CopyIncomePeriod;
  from: string | null;
  to: string;
  generatedAt: string;
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

export default function AdminCopyIncomePage() {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<CopyIncomePeriod>("DAY");
  const [data, setData] = React.useState<Payload | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async (nextPeriod: CopyIncomePeriod) => {
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
  }, [t]);

  React.useEffect(() => {
    void load(period);
  }, [load, period]);

  function exportCsv() {
    if (!data) return;
    const header = [
      "bucket",
      "platformFees",
      "performanceFees",
      "copyInOutFees",
      "networkPaid",
      "companyKept",
      "totalIncome",
      "grossPositive",
      "grossNegative",
      "opsClosed",
      "deposits",
    ];
    const lines = [
      header.join(","),
      ...data.buckets.map((row) =>
        [
          row.bucket,
          row.platformFees,
          row.performanceFees,
          row.copyInOutFees,
          row.networkPaid,
          row.companyKept,
          row.totalIncome,
          row.grossPositive,
          row.grossNegative,
          row.opsClosed,
          row.deposits,
        ]
          .map(csvCell)
          .join(","),
      ),
      "",
      ["trader", ...header.slice(1)].join(","),
      ...data.traders.map((row) =>
        [
          row.traderName,
          row.platformFees,
          row.performanceFees,
          row.copyInOutFees,
          row.networkPaid,
          row.companyKept,
          row.totalIncome,
          row.grossPositive,
          row.grossNegative,
          row.opsClosed,
          row.deposits,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];
    downloadCsv(
      `copy-income-${data.period.toLowerCase()}-${data.to.slice(0, 10)}.csv`,
      lines.join("\n"),
    );
  }

  const totals = data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.copyTrading.incomeTitle")}
        subtitle={t("admin.copyTrading.incomeSubtitle")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/copy-trading">
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("admin.copyTrading.backToList")}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data}
              onClick={exportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
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
            from: data.from ? new Date(data.from).toISOString().slice(0, 10) : "—",
            to: new Date(data.to).toISOString().slice(0, 10),
          })}
        </p>
      ) : null}

      {loading && !data ? (
        <p className="py-12 text-center text-sm text-text-muted">
          {t("common.loading")}
        </p>
      ) : !totals ? (
        <p className="text-sm text-text-muted">{t("errors.signInFailed")}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={t("admin.copyTrading.incomePlatform")}
              value={money(totals.platformFees)}
              tone="gold"
            />
            <Metric
              label={t("admin.copyTrading.livePerformanceFees")}
              value={money(totals.performanceFees)}
              tone="gold"
            />
            <Metric
              label={t("admin.copyTrading.incomeCopyInOut")}
              value={money(totals.copyInOutFees)}
            />
            <Metric
              label={t("admin.copyTrading.liveNetworkPaid")}
              value={money(totals.networkPaid)}
            />
            <Metric
              label={t("admin.copyTrading.liveCompanyKept")}
              value={money(totals.companyKept)}
              tone="gold"
            />
            <Metric
              label={t("admin.copyTrading.liveTotalIncome")}
              value={money(totals.totalIncome)}
              tone="gold"
            />
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
          </div>

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

function IncomeTable({
  rows,
}: {
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
          <TH className="text-right">{t("admin.copyTrading.livePlatformFeeCol")}</TH>
          <TH className="text-right">
            {t("admin.copyTrading.livePerformanceFeeCol")}
          </TH>
          <TH className="text-right">{t("admin.copyTrading.liveNetworkPaid")}</TH>
          <TH className="text-right">{t("admin.copyTrading.liveCompanyKept")}</TH>
          <TH className="text-right">{t("admin.copyTrading.liveTotalIncome")}</TH>
          <TH className="text-right">{t("admin.copyTrading.incomeOpsClosed")}</TH>
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
                {money(row.platformFees)}
              </TD>
              <TD className="text-right font-mono text-gold">
                {money(row.performanceFees)}
              </TD>
              <TD className="text-right font-mono">{money(row.networkPaid)}</TD>
              <TD className="text-right font-mono text-gold">
                {money(row.companyKept)}
              </TD>
              <TD className="text-right font-mono text-gold">
                {money(row.totalIncome)}
              </TD>
              <TD className="text-right font-mono">{row.opsClosed}</TD>
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
