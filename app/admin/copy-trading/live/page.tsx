"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LiveCountdown } from "@/components/admin/live-countdown";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { apiFetch } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/utils";

type PeriodStats = { avgBps: number; count: number };

type LiveStatus =
  | {
      kind: "OPEN";
      symbol: string;
      direction: "LONG" | "SHORT";
      leverage: number;
      openedAt: string;
      closesAt: string;
      targetReturnBps: number;
      floatingReturnBps: number;
    }
  | { kind: "NEXT"; nextAt: string }
  | { kind: "RESTING"; nextAt: string }
  | { kind: "DUE" };

type Payload = {
  generatedAt: string;
  summary: {
    platformFees: number;
    performanceFees: number;
    networkPaid: number;
    companyKept: number;
    companyEconomicPnl?: number;
    totalIncome: number;
    grossPositive: number;
    grossNegative: number;
    netGross: number;
    realDeposits: number;
    connectedCapital: number;
    tradersWithFee: number;
    traders: number;
    openFeeBps: number;
    activeSymbols: string[];
    markets: Array<{ symbol: string; short: string }>;
  };
  openOperations: Array<{
    id: string;
    traderId: string;
    traderName: string;
    symbol: string;
    direction: "LONG" | "SHORT";
    leverage: number;
    openedAt: string;
    closesAt: string;
    floatingReturnBps: number;
    platformFee: number;
  }>;
  closedFees: Array<{
    id: string;
    traderName: string;
    symbol: string;
    settledReturnBps: number;
    platformFee: number;
    performanceFee: number;
    closedAt: string;
  }>;
  traders: Array<{
    id: string;
    name: string;
    isActive: boolean;
    capital: number;
    today: PeriodStats;
    week: PeriodStats;
    month: PeriodStats;
    all: PeriodStats;
    platformFees: number;
    performanceFees: number;
    opsToday: number;
    opsTarget: number;
    status: LiveStatus;
    target: {
      enabled: boolean;
      targetBps: number;
      cycleDays: number;
      dayIndex: number;
      progressBps: number;
      expectedBps: number;
    };
  }>;
};

function money(value: number, signed = false) {
  const abs = `$${formatNumber(Math.abs(value), { decimals: 2 })}`;
  if (!signed) return value < 0 ? `-${abs}` : abs;
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

function pct(bps: number) {
  return `${bps >= 0 ? "+" : ""}${(bps / 100).toFixed(2)}%`;
}

function toneClass(value: number) {
  if (value > 0) return "text-success";
  if (value < 0) return "text-danger";
  return "text-text-primary";
}

export default function AdminCopyLiveBoardPage() {
  const { t } = useI18n();
  const [data, setData] = React.useState<Payload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [coinBusy, setCoinBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await apiFetch<Payload & { ok: boolean }>("/api/admin/copy/live");
      setData(next);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function closeNow(opId: string) {
    if (!window.confirm(t("admin.copyTrading.closeNowConfirm"))) return;
    setBusyId(opId);
    try {
      await apiFetch(`/api/admin/copy/operations/${opId}/close`, {
        method: "POST",
      });
      toast.success(t("admin.copyTrading.closedNow"));
      await load(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCoin(symbol: string, enabled: boolean) {
    const current = data?.summary.activeSymbols ?? [];
    const next = enabled
      ? [...new Set([...current, symbol])]
      : current.filter((item) => item !== symbol);
    if (next.length === 0) {
      toast.error(t("admin.copyTrading.coinsNeedOne"));
      return;
    }
    setCoinBusy(symbol);
    try {
      const result = await apiFetch<{
        config: { activeSymbols: string[] };
      }>("/api/admin/copy/config", {
        method: "PATCH",
        body: JSON.stringify({ activeSymbols: next }),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              summary: {
                ...prev.summary,
                activeSymbols: result.config.activeSymbols,
              },
            }
          : prev,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setCoinBusy(null);
    }
  }

  function statusLabel(status: LiveStatus) {
    if (status.kind === "OPEN") {
      return (
        <span>
          {status.symbol} {status.direction} x{status.leverage} ·{" "}
          {pct(status.floatingReturnBps)} → {pct(status.targetReturnBps)} ·{" "}
          <LiveCountdown
            iso={status.closesAt}
            dueLabel={t("admin.copyTrading.dueNow")}
          />
        </span>
      );
    }
    if (status.kind === "NEXT") {
      return (
        <span>
          {t("admin.copyTrading.liveNextIn")}{" "}
          <LiveCountdown
            iso={status.nextAt}
            dueLabel={t("admin.copyTrading.dueNow")}
          />
        </span>
      );
    }
    if (status.kind === "RESTING") {
      return (
        <span>
          {t("admin.copyTrading.liveResting")} ·{" "}
          <LiveCountdown
            iso={status.nextAt}
            dueLabel={t("admin.copyTrading.dueNow")}
          />
        </span>
      );
    }
    return t("admin.copyTrading.dueNow");
  }

  function statsCell(stats: PeriodStats) {
    if (stats.count === 0) {
      return <span className="text-text-muted">—</span>;
    }
    return (
      <span className={`font-mono ${toneClass(stats.avgBps)}`}>
        {pct(stats.avgBps)}{" "}
        <span className="text-text-muted">({stats.count})</span>
      </span>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.copyTrading.liveBoardTitle")}
        subtitle={t("admin.copyTrading.liveBoardSubtitle")}
      />

      {loading && !data ? (
        <p className="py-12 text-center text-sm text-text-muted">
          {t("common.loading")}
        </p>
      ) : !summary ? (
        <p className="text-sm text-text-muted">{t("errors.signInFailed")}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={t("admin.copyTrading.companyEconomicPnl")}
              value={money(summary.companyEconomicPnl ?? 0, true)}
              tone={
                (summary.companyEconomicPnl ?? 0) >= 0 ? "positive" : "negative"
              }
            />
            <Metric
              label={t("admin.copyTrading.livePlatformFees", {
                pct: (summary.openFeeBps / 100).toFixed(2),
              })}
              value={money(summary.platformFees)}
              tone="gold"
            />
            <Metric
              label={t("admin.copyTrading.livePerformanceFees")}
              value={money(summary.performanceFees)}
              tone="gold"
            />
            <Metric
              label={t("admin.copyTrading.liveGrossPositive")}
              value={money(summary.grossPositive, true)}
              tone="positive"
            />
            <Metric
              label={t("admin.copyTrading.liveGrossNegative")}
              value={money(summary.grossNegative, true)}
              tone="negative"
            />
            <Metric
              label={t("admin.copyTrading.liveNetGross")}
              value={money(summary.netGross, true)}
              tone={summary.netGross >= 0 ? "positive" : "negative"}
            />
            <Metric
              label={t("admin.copyTrading.liveTradersWithFee")}
              value={`${summary.tradersWithFee} / ${summary.traders}`}
            />
            <Metric
              label={t("admin.copyTrading.liveRealDeposits")}
              value={money(summary.realDeposits)}
              tone="positive"
            />
            <Metric
              label={t("admin.copyTrading.liveTotalIncome")}
              value={money(summary.totalIncome)}
              tone="gold"
            />
            <Metric
              label={t("admin.copyTrading.liveNetworkPaid")}
              value={money(summary.networkPaid)}
            />
            <Metric
              label={t("admin.copyTrading.feesKept")}
              value={money(summary.companyKept)}
              tone="gold"
            />
            <Metric
              label={t("admin.copyTrading.connectedCapital")}
              value={money(summary.connectedCapital)}
              tone="gold"
            />
            <Metric
              label={t("admin.copyTrading.activeCoins")}
              value={`${summary.activeSymbols.length} / ${summary.markets.length}`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.activeCoins")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-text-muted">
                {t("admin.copyTrading.activeCoinsHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                {summary.markets.map((market) => {
                  const on = summary.activeSymbols.includes(market.symbol);
                  return (
                    <label
                      key={market.symbol}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        on
                          ? "border-gold/40 bg-gold/10"
                          : "border-border-subtle text-text-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={coinBusy != null}
                        onChange={(event) =>
                          void toggleCoin(market.symbol, event.target.checked)
                        }
                      />
                      {market.short}
                      <span className="text-xs text-text-muted">
                        {market.symbol.replace("USDT", "/USDT")}
                      </span>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.liveOpenOps")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.openOperations.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">
                  {t("admin.copyTrading.liveNoOpenOps")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <THeadRow>
                      <TH>{t("admin.copyTrading.trader")}</TH>
                      <TH>{t("admin.copyTrading.symbol")}</TH>
                      <TH>{t("admin.copyTrading.direction")}</TH>
                      <TH className="text-right">{t("admin.copyTrading.leverage")}</TH>
                      <TH>{t("admin.copyTrading.openedAt")}</TH>
                      <TH>{t("admin.copyTrading.closesAt")}</TH>
                      <TH className="text-right">{t("admin.copyTrading.pnl")}</TH>
                      <TH />
                    </THeadRow>
                    <TBody>
                      {data.openOperations.map((op) => (
                        <TR key={op.id}>
                          <TD className="font-medium">{op.traderName}</TD>
                          <TD>{op.symbol}</TD>
                          <TD>{op.direction}</TD>
                          <TD className="text-right font-mono">x{op.leverage}</TD>
                          <TD className="font-mono text-xs">
                            {new Date(op.openedAt).toLocaleTimeString()}
                          </TD>
                          <TD>
                            <LiveCountdown
                              iso={op.closesAt}
                              dueLabel={t("admin.copyTrading.dueNow")}
                            />
                          </TD>
                          <TD
                            className={`text-right font-mono ${toneClass(op.floatingReturnBps)}`}
                          >
                            {pct(op.floatingReturnBps)}
                          </TD>
                          <TD className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busyId === op.id}
                              onClick={() => void closeNow(op.id)}
                            >
                              {t("admin.copyTrading.closeNow")}
                            </Button>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.liveClosedFees")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.closedFees.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">
                  {t("admin.copyTrading.liveNoClosedFees")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <THeadRow>
                      <TH>{t("admin.copyTrading.trader")}</TH>
                      <TH>{t("admin.copyTrading.symbol")}</TH>
                      <TH className="text-right">{t("admin.copyTrading.settled")}</TH>
                      <TH className="text-right">
                        {t("admin.copyTrading.livePlatformFeeCol")}
                      </TH>
                      <TH className="text-right">
                        {t("admin.copyTrading.livePerformanceFeeCol")}
                      </TH>
                      <TH>{t("admin.copyTrading.closesAt")}</TH>
                    </THeadRow>
                    <TBody>
                      {data.closedFees.map((row) => (
                        <TR key={row.id}>
                          <TD className="font-medium">{row.traderName}</TD>
                          <TD>{row.symbol}</TD>
                          <TD
                            className={`text-right font-mono ${toneClass(row.settledReturnBps)}`}
                          >
                            {pct(row.settledReturnBps)}
                          </TD>
                          <TD className="text-right font-mono text-gold">
                            {money(row.platformFee)}
                          </TD>
                          <TD className="text-right font-mono text-gold">
                            {money(row.performanceFee)}
                          </TD>
                          <TD className="font-mono text-xs text-text-muted">
                            {new Date(row.closedAt).toLocaleTimeString()}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.liveTraderBoard")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <THeadRow>
                    <TH>{t("admin.copyTrading.trader")}</TH>
                    <TH className="text-right">
                      {t("admin.copyTrading.connectedCapital")}
                    </TH>
                    <TH>{t("admin.copyTrading.liveToday")}</TH>
                    <TH>{t("admin.copyTrading.liveWeek")}</TH>
                    <TH>{t("admin.copyTrading.liveMonth")}</TH>
                    <TH>{t("admin.copyTrading.liveAll")}</TH>
                    <TH className="text-right">
                      {t("admin.copyTrading.livePlatformFeeCol")}
                    </TH>
                    <TH className="text-right">
                      {t("admin.copyTrading.livePerformanceFeeCol")}
                    </TH>
                    <TH>{t("admin.copyTrading.opsToday")}</TH>
                    <TH>{t("admin.copyTrading.monthlyTarget")}</TH>
                    <TH>{t("admin.copyTrading.liveCurrentOp")}</TH>
                  </THeadRow>
                  <TBody>
                    {data.traders.map((trader) => (
                      <TR key={trader.id}>
                        <TD className="font-medium">
                          <Link
                            href={`/admin/copy-trading/${trader.id}`}
                            className="hover:text-gold"
                          >
                            {trader.name}
                          </Link>
                          {!trader.isActive ? (
                            <Badge className="ml-2">
                              {t("admin.copyTrading.inactive")}
                            </Badge>
                          ) : null}
                        </TD>
                        <TD className="text-right font-mono">
                          {money(trader.capital)}
                        </TD>
                        <TD>{statsCell(trader.today)}</TD>
                        <TD>{statsCell(trader.week)}</TD>
                        <TD>{statsCell(trader.month)}</TD>
                        <TD>{statsCell(trader.all)}</TD>
                        <TD className="text-right font-mono text-gold">
                          {money(trader.platformFees)}
                        </TD>
                        <TD className="text-right font-mono text-gold">
                          {money(trader.performanceFees)}
                        </TD>
                        <TD className="font-mono">
                          {trader.opsToday} / {trader.opsTarget}
                        </TD>
                        <TD className="text-xs text-text-secondary">
                          {trader.target.enabled
                            ? t("admin.copyTrading.liveTargetCell", {
                                pct: (trader.target.targetBps / 100).toFixed(1),
                                progress: (trader.target.progressBps / 100).toFixed(1),
                                day: trader.target.dayIndex,
                                days: trader.target.cycleDays,
                              })
                            : "—"}
                        </TD>
                        <TD className="max-w-[280px] text-xs text-text-secondary">
                          {statusLabel(trader.status)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
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
