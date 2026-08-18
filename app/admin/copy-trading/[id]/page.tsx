"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LiveCountdown } from "@/components/admin/live-countdown";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { apiFetch } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber, shortenAddress } from "@/lib/utils";

type Operation = {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  leverage: number;
  entryPrice: number;
  exitPrice: number | null;
  targetReturnBps: number;
  floatingReturnBps: number;
  settledReturnBps: number | null;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closesAt: string;
  closedAt: string | null;
  synthetic?: boolean;
};

type Desk = {
  trader: {
    id: string;
    name: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    aum: number;
    totalInvested: number;
    investorsCount: number;
    maxInvestors: number;
    roiBps: number;
    cumulativeRoiBps: number;
    winRateBps: number;
    maxDrawdownBps: number;
    profitDays: number;
    winningTrades: number;
    losingTrades: number;
    experienceDays: number;
    followersCount: number;
    performanceFeeBps: number;
    isVisible: boolean;
    isActive: boolean;
    isFeatured: boolean;
    simulationEnabled: boolean;
  };
  situation: {
    activeCopies: number;
    eligibleTonight: number;
    skippedAfterCutoff: number;
    lossProtectedTonight: number;
    principal: number;
    currentValue: number;
    pnl: number;
    companyFees: number;
    networkCommissions?: number;
    cutoffAt: string;
    cutoffHour: number;
  };
  publicFacing: {
    aum: number;
    totalInvested: number;
    performanceFeeBps: number;
    investorsCount: number;
    maxInvestors: number;
    roiBps: number;
    cumulativeRoiBps: number;
    winRateBps: number;
    avgReturnBps: number | null;
    opsCount: number;
    periodWinRateBps: number;
    curve7dReturnBps: number | null;
  };
  copiers: Array<{
    investmentId: string;
    username: string | null;
    walletAddress: string;
    principal: number;
    currentValue: number;
    pnl: number;
    roiBps: number;
    startedAt: string;
    eligibleTonight: boolean;
    lossProtected: boolean;
  }>;
  chartPoints: Array<{ id: string; date: string; valueBps: number }>;
  operations: Operation[];
  liveSchedule: {
    enabled: boolean;
    opsToday: number;
    opsTarget: number;
    minOpsPerDay: number;
    maxOpsPerDay: number;
    durationMinMinutes: number;
    durationMaxMinutes: number;
    nextOperationAt: string | null;
    currentClosesAt: string | null;
    currentOperationId: string | null;
  };
  target: {
    enabled: boolean;
    targetBps: number;
    cycleDays: number;
    startedAt: string | null;
    elapsedDays: number;
    dayIndex: number;
    progressBps: number;
    expectedBps: number;
  };
  events: Array<{
    id: string;
    returnBps: number;
    source: string;
    createdAt: string;
  }>;
  scheduledManual: Array<{
    id: string;
    returnBps: number;
    executeAt: string;
    createdAt: string;
  }>;
};

type OpForm = {
  symbol: string;
  direction: "LONG" | "SHORT";
  leverage: string;
  entryPrice: string;
  targetPct: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closesAt: string;
  exitPrice: string;
  settledPct: string;
};

const EMPTY_OP: OpForm = {
  symbol: "BTCUSDT",
  direction: "LONG",
  leverage: "10",
  entryPrice: "",
  targetPct: "0.40",
  status: "OPEN",
  openedAt: "",
  closesAt: "",
  exitPrice: "",
  settledPct: "0.40",
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function operationPayload(form: OpForm) {
  return {
    symbol: form.symbol,
    direction: form.direction,
    leverage: Math.trunc(Number(form.leverage) || 1),
    entryPrice: Number(form.entryPrice) || 0,
    targetReturnBps: Math.round((Number(form.targetPct) || 0) * 100),
    status: form.status,
    openedAt: fromLocalInput(form.openedAt),
    closesAt: fromLocalInput(form.closesAt),
    closedAt: form.status === "CLOSED" ? fromLocalInput(form.closesAt) : null,
    exitPrice: form.exitPrice ? Number(form.exitPrice) : null,
    settledReturnBps:
      form.status === "CLOSED"
        ? Math.round((Number(form.settledPct) || 0) * 100)
        : null,
  };
}

export default function AdminCopyTraderDeskPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const traderId = String(params.id ?? "");

  const [desk, setDesk] = React.useState<Desk | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [chartDate, setChartDate] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [chartPct, setChartPct] = React.useState("");
  const [stats, setStats] = React.useState({
    roiPct: "",
    cumulativePct: "",
    winRatePct: "",
    drawdownPct: "",
    profitDays: "",
    winningTrades: "",
    losingTrades: "",
    experienceDays: "",
    followersCount: "",
  });
  const [opForm, setOpForm] = React.useState<OpForm>(EMPTY_OP);
  const [editingOp, setEditingOp] = React.useState<Operation | "new" | null>(
    null,
  );
  const [histMonths, setHistMonths] = React.useState("3");
  const [histBias, setHistBias] = React.useState<"neutral" | "positive" | "negative">(
    "neutral",
  );
  const [manualPct, setManualPct] = React.useState("");
  const [manualDelay, setManualDelay] = React.useState("0");

  const load = React.useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const next = await apiFetch<Desk & { ok: boolean }>(
          `/api/admin/copy/traders/${traderId}`,
        );
        setDesk(next);
        if (!silent) {
          setStats({
            roiPct: (next.trader.roiBps / 100).toFixed(2),
            cumulativePct: (next.trader.cumulativeRoiBps / 100).toFixed(2),
            winRatePct: (next.trader.winRateBps / 100).toFixed(2),
            drawdownPct: (next.trader.maxDrawdownBps / 100).toFixed(2),
            profitDays: String(next.trader.profitDays),
            winningTrades: String(next.trader.winningTrades),
            losingTrades: String(next.trader.losingTrades),
            experienceDays: String(next.trader.experienceDays),
            followersCount: String(next.trader.followersCount),
          });
        }
      } catch (error) {
        if (!silent) {
          toast.error(
            error instanceof Error ? error.message : t("errors.signInFailed"),
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [t, traderId],
  );

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 5_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function repairChart() {
    setBusy("repair");
    try {
      const result = await apiFetch<{ fixedDays: number }>(
        `/api/admin/copy/traders/${traderId}/repair-chart`,
        { method: "POST" },
      );
      toast.success(
        t("admin.copyTrading.repairChartDone", { n: result.fixedDays }),
      );
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveStats() {
    setBusy("stats");
    try {
      await apiFetch(`/api/admin/copy/traders/${traderId}/vitrina`, {
        method: "PATCH",
        body: JSON.stringify({
          roiBps: Math.round((Number(stats.roiPct) || 0) * 100),
          cumulativeRoiBps: Math.round((Number(stats.cumulativePct) || 0) * 100),
          winRateBps: Math.round((Number(stats.winRatePct) || 0) * 100),
          maxDrawdownBps: Math.round((Number(stats.drawdownPct) || 0) * 100),
          profitDays: Math.trunc(Number(stats.profitDays) || 0),
          winningTrades: Math.trunc(Number(stats.winningTrades) || 0),
          losingTrades: Math.trunc(Number(stats.losingTrades) || 0),
          experienceDays: Math.trunc(Number(stats.experienceDays) || 0),
          followersCount: Math.trunc(Number(stats.followersCount) || 0),
        }),
      });
      toast.success(t("admin.copyTrading.saved"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveChartPoint() {
    const pct = Number(chartPct);
    if (!chartDate || !Number.isFinite(pct)) {
      toast.error(t("admin.copyTrading.invalidReturn"));
      return;
    }
    setBusy("chart");
    try {
      await apiFetch(`/api/admin/copy/traders/${traderId}/chart`, {
        method: "PUT",
        body: JSON.stringify({
          date: chartDate,
          valueBps: Math.round(pct * 100),
        }),
      });
      toast.success(t("admin.copyTrading.savedPoint"));
      setChartPct("");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function removeChartPoint(date: string) {
    setBusy(`chart:${date}`);
    try {
      await apiFetch(`/api/admin/copy/traders/${traderId}/chart`, {
        method: "DELETE",
        body: JSON.stringify({ date }),
      });
      toast.success(t("admin.copyTrading.deletedPoint"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  function openNewOp() {
    const now = new Date();
    const later = new Date(now.getTime() + 10 * 60 * 1000);
    setOpForm({
      ...EMPTY_OP,
      openedAt: toLocalInput(now.toISOString()),
      closesAt: toLocalInput(later.toISOString()),
    });
    setEditingOp("new");
  }

  function openEditOp(op: Operation) {
    setOpForm({
      symbol: op.symbol,
      direction: op.direction,
      leverage: String(op.leverage),
      entryPrice: String(op.entryPrice),
      targetPct: ((op.targetReturnBps ?? op.floatingReturnBps) / 100).toFixed(2),
      status: op.status,
      openedAt: toLocalInput(op.openedAt),
      closesAt: toLocalInput(op.closesAt),
      exitPrice: op.exitPrice != null ? String(op.exitPrice) : "",
      settledPct: ((op.settledReturnBps ?? 0) / 100).toFixed(2),
    });
    setEditingOp(op);
  }

  async function saveOperation() {
    const current = editingOp;
    if (!current) return;
    setBusy("op");
    try {
      if (current === "new") {
        await apiFetch(`/api/admin/copy/traders/${traderId}/operations`, {
          method: "POST",
          body: JSON.stringify(operationPayload(opForm)),
        });
      } else {
        await apiFetch(`/api/admin/copy/operations/${current.id}`, {
          method: "PATCH",
          body: JSON.stringify(operationPayload(opForm)),
        });
      }
      toast.success(t("admin.copyTrading.operationSaved"));
      setEditingOp(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function closeOperationNow(id: string) {
    if (!window.confirm(t("admin.copyTrading.closeNowConfirm"))) return;
    setBusy(`close:${id}`);
    try {
      await apiFetch(`/api/admin/copy/operations/${id}/close`, { method: "POST" });
      toast.success(t("admin.copyTrading.closedNow"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function setTarget(input: {
    targetMode: boolean;
    monthlyTargetBps?: number;
    targetCycleDays?: number;
  }) {
    setBusy("target");
    try {
      await apiFetch(`/api/admin/copy/traders/${traderId}/target`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      toast.success(t("admin.copyTrading.targetSaved"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function removeOperation(id: string) {
    if (!window.confirm(t("admin.copyTrading.confirmDeleteOp"))) return;
    setBusy(`op:${id}`);
    try {
      await apiFetch(`/api/admin/copy/operations/${id}`, { method: "DELETE" });
      toast.success(t("admin.copyTrading.operationDeleted"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function deleteTrader() {
    if (!desk) return;
    if (
      !window.confirm(
        t("admin.copyTrading.confirmDeleteOne", { name: desk.trader.name }),
      )
    ) {
      return;
    }
    setBusy("delete");
    try {
      const result = await apiFetch<{
        deleted: number;
        refunded: number;
        refundedAmount: number;
      }>("/api/admin/copy/traders/delete", {
        method: "POST",
        body: JSON.stringify({ ids: [traderId] }),
      });
      toast.success(
        t("admin.copyTrading.deleted", {
          n: result.deleted,
          refunded: result.refunded,
          amount: formatNumber(result.refundedAmount, { decimals: 2 }),
        }),
      );
      router.push("/admin/copy-trading");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
      setBusy(null);
    }
  }

  async function generateHistory() {
    const months = Math.trunc(Number(histMonths));
    if (!Number.isInteger(months) || months < 1 || months > 12) {
      toast.error(t("admin.copyTrading.historyMonthsInvalid"));
      return;
    }
    if (
      !window.confirm(t("admin.copyTrading.historyConfirm", { n: months }))
    ) {
      return;
    }
    setBusy("history");
    try {
      const result = await apiFetch<{ created: number }>(
        `/api/admin/copy/traders/${traderId}/history`,
        {
          method: "POST",
          body: JSON.stringify({ months, bias: histBias }),
        },
      );
      toast.success(
        t("admin.copyTrading.historyDone", { n: result.created }),
      );
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function applyManual(sign: 1 | -1) {
    const mag = Math.abs(Number(manualPct));
    if (!Number.isFinite(mag) || mag <= 0 || mag > 100) {
      toast.error(t("admin.copyTrading.manualPctInvalid"));
      return;
    }
    const delayMinutes = Math.max(0, Number(manualDelay) || 0);
    setBusy(sign > 0 ? "manual-gain" : "manual-loss");
    try {
      const result = await apiFetch<{ scheduled: boolean }>(
        `/api/admin/copy/traders/${traderId}/manual`,
        {
          method: "POST",
          body: JSON.stringify({
            returnBps: Math.round(mag * 100) * sign,
            delayMinutes,
          }),
        },
      );
      toast.success(
        result.scheduled
          ? t("admin.copyTrading.manualScheduled")
          : t("admin.copyTrading.manualApplied"),
      );
      setManualPct("");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function cancelScheduled(actionId: string) {
    setBusy(`sched:${actionId}`);
    try {
      await apiFetch(`/api/admin/copy/traders/${traderId}/manual/${actionId}`, {
        method: "DELETE",
      });
      toast.success(t("admin.copyTrading.manualCanceled"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  const updateOp = <K extends keyof OpForm>(key: K, value: OpForm[K]) =>
    setOpForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={desk?.trader.name ?? t("admin.copyTrading.deskTitle")}
        subtitle={t("admin.copyTrading.deskSubtitle")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/copy-trading">
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("admin.copyTrading.backToList")}
              </Link>
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={busy === "delete"}
              onClick={() => void deleteTrader()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("admin.copyTrading.deleteTrader")}
            </Button>
          </div>
        }
      />

      {loading && !desk ? (
        <p className="py-12 text-center text-sm text-text-muted">
          {t("common.loading")}
        </p>
      ) : !desk ? (
        <p className="py-12 text-center text-sm text-text-muted">
          {t("admin.userDetail.notFound")}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={t("admin.copyTrading.connectedCapital")}
              value={`$${formatNumber(desk.situation.currentValue, { decimals: 2 })}`}
              tone="gold"
            />
            <Metric
              label={t("admin.copyTrading.activeCopiers")}
              value={`${desk.situation.activeCopies} / ${desk.situation.eligibleTonight}`}
            />
            <Metric
              label={t("admin.copyTrading.platformPnl")}
              value={`${desk.situation.pnl >= 0 ? "+" : ""}$${formatNumber(desk.situation.pnl, { decimals: 2 })}`}
              tone={desk.situation.pnl >= 0 ? "positive" : "negative"}
            />
            <Metric
              label={t("admin.copyTrading.companyIncome")}
              value={`$${formatNumber(desk.situation.companyFees, { decimals: 2 })}`}
              tone="gold"
            />
          </div>
          <p className="text-xs text-text-muted">
            {t("admin.copyTrading.companyIncomeHint")} ·{" "}
            {t("admin.copyTrading.networkPaid", {
              amount: formatNumber(desk.situation.networkCommissions ?? 0, {
                decimals: 2,
              }),
            })}{" "}
            · {t("admin.copyTrading.eligibleTonight")}:{" "}
            {desk.situation.eligibleTonight} ·{" "}
            {t("admin.copyTrading.afterCutoff")}:{" "}
            {desk.situation.skippedAfterCutoff} · UTC {desk.situation.cutoffHour}
            :00 · {t("admin.copyTrading.lossProtected", {
              n: desk.situation.lossProtectedTonight,
            })}
          </p>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {t("admin.copyTrading.publicFacing")}
              </CardTitle>
              <div className="flex flex-wrap gap-1">
                {desk.trader.isFeatured ? (
                  <Badge variant="warning">
                    {t("admin.copyTrading.featured")}
                  </Badge>
                ) : null}
                {!desk.trader.isVisible ? (
                  <Badge variant="outline">
                    {t("admin.copyTrading.hidden")}
                  </Badge>
                ) : (
                  <Badge variant="success">
                    {t("admin.copyTrading.visible")}
                  </Badge>
                )}
                <Badge variant="outline">
                  {t(`admin.copyTrading.risk${desk.trader.riskLevel}`)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-text-muted">
                {t("admin.copyTrading.publicFacingHint")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                  label={t("admin.copyTrading.publicAum")}
                  value={`$${formatNumber(desk.publicFacing.aum, { decimals: 2 })}`}
                />
                <Metric
                  label={t("admin.copyTrading.publicCapital")}
                  value={`$${formatNumber(desk.publicFacing.totalInvested, { decimals: 2 })}`}
                />
                <Metric
                  label={t("admin.copyTrading.performanceFee")}
                  value={`${(desk.publicFacing.performanceFeeBps / 100).toFixed(2)}%`}
                />
                <Metric
                  label={t("admin.copyTrading.publicCopiers")}
                  value={`${desk.publicFacing.investorsCount} / ${desk.publicFacing.maxInvestors}`}
                />
                <Metric
                  label={t("admin.copyTrading.roi")}
                  value={`${desk.publicFacing.roiBps >= 0 ? "+" : ""}${(desk.publicFacing.roiBps / 100).toFixed(2)}%`}
                  tone={desk.publicFacing.roiBps >= 0 ? "positive" : "negative"}
                />
                <Metric
                  label={t("admin.copyTrading.cumulativeRoi")}
                  value={`${desk.publicFacing.cumulativeRoiBps >= 0 ? "+" : ""}${(desk.publicFacing.cumulativeRoiBps / 100).toFixed(2)}%`}
                  tone={
                    desk.publicFacing.cumulativeRoiBps >= 0
                      ? "positive"
                      : "negative"
                  }
                />
                <Metric
                  label={t("admin.copyTrading.winRate")}
                  value={`${(desk.publicFacing.winRateBps / 100).toFixed(2)}%`}
                />
                <Metric
                  label={t("admin.copyTrading.curve7d")}
                  value={
                    desk.publicFacing.curve7dReturnBps == null
                      ? "—"
                      : `${desk.publicFacing.curve7dReturnBps >= 0 ? "+" : ""}${(desk.publicFacing.curve7dReturnBps / 100).toFixed(2)}%`
                  }
                  tone={
                    desk.publicFacing.curve7dReturnBps == null
                      ? undefined
                      : desk.publicFacing.curve7dReturnBps >= 0
                        ? "positive"
                        : "negative"
                  }
                />
                <Metric
                  label={t("admin.copyTrading.avgReturnWeek")}
                  value={
                    desk.publicFacing.avgReturnBps == null
                      ? "—"
                      : `${desk.publicFacing.avgReturnBps >= 0 ? "+" : ""}${(desk.publicFacing.avgReturnBps / 100).toFixed(2)}%`
                  }
                  tone={
                    desk.publicFacing.avgReturnBps == null
                      ? undefined
                      : desk.publicFacing.avgReturnBps >= 0
                        ? "positive"
                        : "negative"
                  }
                />
                <Metric
                  label={t("admin.copyTrading.opsWeek")}
                  value={String(desk.publicFacing.opsCount)}
                />
                <Metric
                  label={t("admin.copyTrading.periodWinRate")}
                  value={`${(desk.publicFacing.periodWinRateBps / 100).toFixed(2)}%`}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.repairChart")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                size="sm"
                variant="outline"
                loading={busy === "repair"}
                onClick={() => void repairChart()}
              >
                {t("admin.copyTrading.repairChart")}
              </Button>
              <p className="text-xs text-text-muted">
                {t("admin.copyTrading.repairChartHint")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.copiers")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {desk.copiers.length === 0 ? (
                <p className="text-sm text-text-muted">
                  {t("admin.copyTrading.noCopiers")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <thead>
                      <THeadRow>
                        <TH>{t("common.user")}</TH>
                        <TH>{t("admin.copyTrading.wallet")}</TH>
                        <TH className="text-right">
                          {t("admin.copyTrading.principal")}
                        </TH>
                        <TH className="text-right">
                          {t("admin.copyTrading.valueLabel")}
                        </TH>
                        <TH className="text-right">{t("admin.copyTrading.pnl")}</TH>
                        <TH />
                      </THeadRow>
                    </thead>
                    <TBody>
                      {desk.copiers.map((row) => (
                        <TR key={row.investmentId}>
                          <TD>{row.username || shortenAddress(row.walletAddress)}</TD>
                          <TD className="font-mono text-xs">
                            {shortenAddress(row.walletAddress)}
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
                          <TD>
                            {row.eligibleTonight ? (
                              row.lossProtected ? (
                                <Badge variant="info">
                                  {t("admin.copyTrading.lossGraceBadge")}
                                </Badge>
                              ) : (
                                <Badge variant="success">
                                  {t("admin.copyTrading.eligibleTonight")}
                                </Badge>
                              )
                            ) : (
                              <Badge variant="outline">
                                {t("admin.copyTrading.afterCutoff")}
                              </Badge>
                            )}
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
                {t("admin.copyTrading.vitrina")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Field label={t("admin.copyTrading.roi")}>
                  <Input
                    type="number"
                    step="0.01"
                    value={stats.roiPct}
                    onChange={(e) =>
                      setStats((s) => ({ ...s, roiPct: e.target.value }))
                    }
                  />
                </Field>
                <Field label={t("admin.copyTrading.cumulativeRoi")}>
                  <Input
                    type="number"
                    step="0.01"
                    value={stats.cumulativePct}
                    onChange={(e) =>
                      setStats((s) => ({ ...s, cumulativePct: e.target.value }))
                    }
                  />
                </Field>
                <Field label={t("admin.copyTrading.winRate")}>
                  <Input
                    type="number"
                    step="0.01"
                    value={stats.winRatePct}
                    onChange={(e) =>
                      setStats((s) => ({ ...s, winRatePct: e.target.value }))
                    }
                  />
                </Field>
                <Field label={t("admin.copyTrading.drawdown")}>
                  <Input
                    type="number"
                    step="0.01"
                    value={stats.drawdownPct}
                    onChange={(e) =>
                      setStats((s) => ({ ...s, drawdownPct: e.target.value }))
                    }
                  />
                </Field>
                <Field label={t("admin.copyTrading.profitDays")}>
                  <Input
                    type="number"
                    value={stats.profitDays}
                    onChange={(e) =>
                      setStats((s) => ({ ...s, profitDays: e.target.value }))
                    }
                  />
                </Field>
                <Field label={t("admin.copyTrading.wins")}>
                  <Input
                    type="number"
                    value={stats.winningTrades}
                    onChange={(e) =>
                      setStats((s) => ({ ...s, winningTrades: e.target.value }))
                    }
                  />
                </Field>
                <Field label={t("admin.copyTrading.losses")}>
                  <Input
                    type="number"
                    value={stats.losingTrades}
                    onChange={(e) =>
                      setStats((s) => ({ ...s, losingTrades: e.target.value }))
                    }
                  />
                </Field>
                <Field label={t("admin.copyTrading.experienceDays")}>
                  <Input
                    type="number"
                    value={stats.experienceDays}
                    onChange={(e) =>
                      setStats((s) => ({ ...s, experienceDays: e.target.value }))
                    }
                  />
                </Field>
                <Field label={t("admin.copyTrading.followers")}>
                  <Input
                    type="number"
                    value={stats.followersCount}
                    onChange={(e) =>
                      setStats((s) => ({ ...s, followersCount: e.target.value }))
                    }
                  />
                </Field>
              </div>
              <Button
                size="sm"
                loading={busy === "stats"}
                onClick={() => void saveStats()}
              >
                {t("admin.copyTrading.saveStats")}
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("admin.copyTrading.history")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label={t("admin.copyTrading.date")}>
                    <Input
                      type="date"
                      value={chartDate}
                      onChange={(e) => setChartDate(e.target.value)}
                    />
                  </Field>
                  <Field label={t("admin.copyTrading.value")}>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-28"
                      value={chartPct}
                      onChange={(e) => setChartPct(e.target.value)}
                    />
                  </Field>
                  <Button
                    size="sm"
                    loading={busy === "chart"}
                    onClick={() => void saveChartPoint()}
                  >
                    {t("admin.copyTrading.addPoint")}
                  </Button>
                </div>
                <div className="max-h-80 overflow-auto">
                  <Table>
                    <thead>
                      <THeadRow>
                        <TH>{t("admin.copyTrading.date")}</TH>
                        <TH className="text-right">
                          {t("admin.copyTrading.value")}
                        </TH>
                        <TH />
                      </THeadRow>
                    </thead>
                    <TBody>
                      {desk.chartPoints.map((point) => (
                        <TR key={point.id}>
                          <TD>{point.date}</TD>
                          <TD
                            className={`text-right font-mono ${point.valueBps >= 0 ? "text-success" : "text-danger"}`}
                          >
                            {point.valueBps >= 0 ? "+" : ""}
                            {(point.valueBps / 100).toFixed(2)}%
                          </TD>
                          <TD className="text-right">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              loading={busy === `chart:${point.date}`}
                              onClick={() => void removeChartPoint(point.date)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {t("admin.copyTrading.liveSchedule")}
                </CardTitle>
                {desk.liveSchedule.currentOperationId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === `close:${desk.liveSchedule.currentOperationId}`}
                    onClick={() =>
                      void closeOperationNow(desk.liveSchedule.currentOperationId!)
                    }
                  >
                    {t("admin.copyTrading.closeNow")}
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="text-sm">
                  <p className="text-xs text-text-muted">
                    {t("admin.copyTrading.opsToday")}
                  </p>
                  <p className="font-mono">
                    {desk.liveSchedule.opsToday} / {desk.liveSchedule.opsTarget}{" "}
                    <span className="text-text-muted">
                      ({t("admin.copyTrading.maxOpsPerDay")} {desk.liveSchedule.maxOpsPerDay})
                    </span>
                  </p>
                </div>
                <div className="text-sm">
                  <p className="text-xs text-text-muted">
                    {t("admin.copyTrading.durationMinMinutes")}
                  </p>
                  <p className="font-mono">
                    {desk.liveSchedule.durationMinMinutes}–
                    {desk.liveSchedule.durationMaxMinutes} min
                  </p>
                </div>
                <div className="text-sm">
                  <p className="text-xs text-text-muted">
                    {t("admin.copyTrading.currentCloseCountdown")}
                  </p>
                  <p>
                    {desk.liveSchedule.currentClosesAt ? (
                      <LiveCountdown
                        iso={desk.liveSchedule.currentClosesAt}
                        dueLabel={t("admin.copyTrading.dueNow")}
                      />
                    ) : (
                      t("admin.copyTrading.noOpenOp")
                    )}
                  </p>
                </div>
                <div className="text-sm">
                  <p className="text-xs text-text-muted">
                    {t("admin.copyTrading.nextOpenCountdown")}
                  </p>
                  <p>
                    {desk.liveSchedule.currentClosesAt ? (
                      t("admin.copyTrading.waitingNext")
                    ) : desk.liveSchedule.nextOperationAt ? (
                      <LiveCountdown
                        iso={desk.liveSchedule.nextOperationAt}
                        dueLabel={t("admin.copyTrading.dueNow")}
                      />
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("admin.copyTrading.monthlyTargetTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {desk.target.enabled ? (
                  <p className="text-sm text-text-secondary">
                    {t("admin.copyTrading.targetActive", {
                      pct: (desk.target.targetBps / 100).toFixed(2),
                      days: desk.target.cycleDays,
                      day: desk.target.dayIndex,
                      progress: (desk.target.progressBps / 100).toFixed(2),
                      expected: (desk.target.expectedBps / 100).toFixed(2),
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-text-muted">
                    {t("admin.copyTrading.targetInactive")}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === "target"}
                    onClick={() =>
                      void setTarget({
                        targetMode: true,
                        monthlyTargetBps: -5000,
                        targetCycleDays: 10,
                      })
                    }
                  >
                    {t("admin.copyTrading.quickTarget50")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === "target"}
                    onClick={() =>
                      void setTarget({
                        targetMode: true,
                        monthlyTargetBps: -9000,
                        targetCycleDays: 10,
                      })
                    }
                  >
                    {t("admin.copyTrading.quickTarget90")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === "target"}
                    onClick={() =>
                      void setTarget({
                        targetMode: false,
                        monthlyTargetBps: 0,
                        targetCycleDays: 30,
                      })
                    }
                  >
                    {t("admin.copyTrading.clearTarget")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("admin.copyTrading.historyTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-text-muted">
                  {t("admin.copyTrading.historyHint")}
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={t("admin.copyTrading.historyMonths")}>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={histMonths}
                      onChange={(event) => setHistMonths(event.target.value)}
                    />
                  </Field>
                  <Field label={t("admin.copyTrading.historyBias")}>
                    <Select
                      value={histBias}
                      onChange={(event) =>
                        setHistBias(
                          event.target.value as
                            | "neutral"
                            | "positive"
                            | "negative",
                        )
                      }
                    >
                      <option value="neutral">
                        {t("admin.copyTrading.biasNeutral")}
                      </option>
                      <option value="positive">
                        {t("admin.copyTrading.biasPositive")}
                      </option>
                      <option value="negative">
                        {t("admin.copyTrading.biasNegative")}
                      </option>
                    </Select>
                  </Field>
                  <div className="flex items-end">
                    <Button
                      size="sm"
                      loading={busy === "history"}
                      onClick={() => void generateHistory()}
                    >
                      {t("admin.copyTrading.generateHistory")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("admin.copyTrading.manualTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-text-muted">
                  {t("admin.copyTrading.manualHint")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("admin.copyTrading.manualPct")}>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      value={manualPct}
                      onChange={(event) => setManualPct(event.target.value)}
                    />
                  </Field>
                  <Field label={t("admin.copyTrading.manualDelay")}>
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      value={manualDelay}
                      onChange={(event) => setManualDelay(event.target.value)}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    loading={busy === "manual-gain"}
                    onClick={() => void applyManual(1)}
                  >
                    {t("admin.copyTrading.manualGain")}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={busy === "manual-loss"}
                    onClick={() => void applyManual(-1)}
                  >
                    {t("admin.copyTrading.manualLoss")}
                  </Button>
                </div>
                {(desk.scheduledManual ?? []).length > 0 ? (
                  <div className="space-y-2 rounded-md border border-warning/25 bg-warning/5 p-3">
                    <p className="text-xs text-warning">
                      {t("admin.copyTrading.manualPending")}
                    </p>
                    {desk.scheduledManual.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span
                          className={
                            row.returnBps >= 0 ? "text-success" : "text-danger"
                          }
                        >
                          {row.returnBps >= 0 ? "+" : ""}
                          {(row.returnBps / 100).toFixed(2)}% ·{" "}
                          {new Date(row.executeAt).toLocaleString()}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busy === `sched:${row.id}`}
                          onClick={() => void cancelScheduled(row.id)}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {t("admin.copyTrading.operations")}
                </CardTitle>
                <Button size="sm" onClick={openNewOp}>
                  {t("admin.copyTrading.newOperation")}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {desk.operations.length === 0 ? (
                  <p className="text-sm text-text-muted">
                    {t("admin.copyTrading.noOpenOp")}
                  </p>
                ) : (
                  desk.operations.map((op) => (
                    <div
                      key={op.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2"
                    >
                      <div className="font-mono text-xs">
                        <Badge variant={op.status === "OPEN" ? "info" : "outline"}>
                          {op.status}
                        </Badge>{" "}
                        <span
                          className={
                            op.direction === "LONG" ? "text-success" : "text-danger"
                          }
                        >
                          {op.symbol} {op.direction} {op.leverage}×
                        </span>{" "}
                        <span
                          className={
                            (op.settledReturnBps ?? op.floatingReturnBps) >= 0
                              ? "text-success"
                              : "text-danger"
                          }
                        >
                          {((op.settledReturnBps ?? op.floatingReturnBps) >= 0
                            ? "+"
                            : "") +
                            (
                              (op.settledReturnBps ?? op.floatingReturnBps) / 100
                            ).toFixed(2)}
                          %
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {op.status === "OPEN" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={busy === `close:${op.id}`}
                            onClick={() => void closeOperationNow(op.id)}
                          >
                            {t("admin.copyTrading.closeNow")}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditOp(op)}
                        >
                          {t("admin.copyTrading.editOperation")}
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          loading={busy === `op:${op.id}`}
                          onClick={() => void removeOperation(op.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.recentActivity")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {desk.events.length === 0 ? (
                <p className="text-sm text-text-muted">
                  {t("admin.copyTrading.noActivity")}
                </p>
              ) : (
                desk.events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between border-b border-border-subtle pb-2 last:border-0"
                  >
                    <p className="text-xs text-text-muted">
                      {event.source === "SIMULATION"
                        ? t("admin.copyTrading.automatic")
                        : t("admin.copyTrading.manual")}{" "}
                      · {new Date(event.createdAt).toLocaleString()}
                    </p>
                    <span
                      className={`font-mono text-sm ${event.returnBps >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {event.returnBps >= 0 ? "+" : ""}
                      {(event.returnBps / 100).toFixed(2)}%
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={editingOp !== null}
        onOpenChange={(open) => !open && setEditingOp(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOp === "new"
                ? t("admin.copyTrading.newOperation")
                : t("admin.copyTrading.editOperation")}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3 sm:grid-cols-2">
            <Field label={t("admin.copyTrading.symbol")}>
              <Input
                value={opForm.symbol}
                onChange={(e) => updateOp("symbol", e.target.value)}
              />
            </Field>
            <Field label={t("admin.copyTrading.direction")}>
              <Select
                value={opForm.direction}
                onChange={(e) =>
                  updateOp("direction", e.target.value as "LONG" | "SHORT")
                }
              >
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </Select>
            </Field>
            <Field label={t("admin.copyTrading.leverage")}>
              <Input
                type="number"
                value={opForm.leverage}
                onChange={(e) => updateOp("leverage", e.target.value)}
              />
            </Field>
            <Field label={t("admin.copyTrading.entry")}>
              <Input
                type="number"
                value={opForm.entryPrice}
                onChange={(e) => updateOp("entryPrice", e.target.value)}
              />
            </Field>
            <Field label={t("admin.copyTrading.target")}>
              <Input
                type="number"
                step="0.01"
                value={opForm.targetPct}
                onChange={(e) => updateOp("targetPct", e.target.value)}
              />
            </Field>
            <Field label={t("admin.copyTrading.opStatus")}>
              <Select
                value={opForm.status}
                onChange={(e) =>
                  updateOp("status", e.target.value as "OPEN" | "CLOSED")
                }
              >
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
              </Select>
            </Field>
            <Field label={t("admin.copyTrading.openedAt")}>
              <Input
                type="datetime-local"
                value={opForm.openedAt}
                onChange={(e) => updateOp("openedAt", e.target.value)}
              />
            </Field>
            <Field label={t("admin.copyTrading.closesAt")}>
              <Input
                type="datetime-local"
                value={opForm.closesAt}
                onChange={(e) => updateOp("closesAt", e.target.value)}
              />
            </Field>
            {opForm.status === "CLOSED" ? (
              <>
                <Field label={t("admin.copyTrading.exit")}>
                  <Input
                    type="number"
                    value={opForm.exitPrice}
                    onChange={(e) => updateOp("exitPrice", e.target.value)}
                  />
                </Field>
                <Field label={t("admin.copyTrading.settled")}>
                  <Input
                    type="number"
                    step="0.01"
                    value={opForm.settledPct}
                    onChange={(e) => updateOp("settledPct", e.target.value)}
                  />
                </Field>
              </>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOp(null)}>
              {t("common.cancel")}
            </Button>
            <Button loading={busy === "op"} onClick={() => void saveOperation()}>
              {t("admin.copyTrading.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
