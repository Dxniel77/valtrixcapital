"use client";

import * as React from "react";
import { Activity, Bot, Pencil, Play, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { apiFetch } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber, shortenAddress } from "@/lib/utils";

type Risk = "LOW" | "MEDIUM" | "HIGH";

type Trader = {
  id: string;
  name: string;
  photoUrl: string | null;
  description: string;
  riskLevel: Risk;
  experienceDays: number;
  followersCount: number;
  investorsCount: number;
  activeInvestments: number;
  aum: number;
  roiBps: number;
  cumulativeRoiBps: number;
  minInvestment: number;
  performanceFeeBps: number;
  maxInvestors: number;
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder: number;
  simulationEnabled: boolean;
  simulationMinBps: number;
  simulationMaxBps: number;
  simulationIntervalHours: number;
  simulationLastRunAt: string | null;
  simulationNextRunAt: string | null;
};

type Dashboard = {
  config?: {
    investFeeBps: number;
    withdrawFeeBps: number;
    settlementCutoffHour: number;
    globalMinInvestment: number;
  };
  metrics: {
    traders: number;
    activeTraders: number;
    automatedTraders: number;
    activeInvestments: number;
    activeUsers: number;
    totalPrincipal: number;
    currentValue: number;
    totalPnl: number;
    pendingWithdrawals: number;
  };
  traders: Trader[];
  openOperations: Array<{
    id: string;
    traderId: string;
    symbol: string;
    direction: "LONG" | "SHORT";
    leverage: number;
    entryPrice: number;
    markPrice: number;
    floatingReturnBps: number;
    closesAt: string;
  }>;
  pendingWithdrawals: Array<{
    id: string;
    traderName: string;
    userName: string;
    walletAddress: string;
    amount: number;
    requestedAt: string;
  }>;
  recentEvents: Array<{
    id: string;
    traderName: string;
    returnBps: number;
    source: string;
    createdAt: string;
  }>;
};

type TraderForm = {
  name: string;
  photoUrl: string;
  description: string;
  riskLevel: Risk;
  experienceDays: string;
  followersCount: string;
  minInvestment: string;
  performanceFeePct: string;
  maxInvestors: string;
  sortOrder: string;
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  simulationEnabled: boolean;
  simulationMinPct: string;
  simulationMaxPct: string;
  simulationIntervalHours: string;
};

const EMPTY_FORM: TraderForm = {
  name: "",
  photoUrl: "",
  description: "",
  riskLevel: "MEDIUM",
  experienceDays: "365",
  followersCount: "0",
  minInvestment: "15",
  performanceFeePct: "10",
  maxInvestors: "180",
  sortOrder: "0",
  isActive: true,
  isVisible: true,
  isFeatured: false,
  simulationEnabled: true,
  simulationMinPct: "-0.5",
  simulationMaxPct: "1",
  simulationIntervalHours: "24",
};

/** `crypto.randomUUID` is unavailable outside secure contexts (plain-HTTP hosts). */
function idempotencyKey(traderId: string): string {
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `admin:${traderId}:${unique}`;
}

function traderToForm(trader: Trader): TraderForm {
  return {
    name: trader.name,
    photoUrl: trader.photoUrl ?? "",
    description: trader.description,
    riskLevel: trader.riskLevel,
    experienceDays: String(trader.experienceDays),
    followersCount: String(trader.followersCount),
    minInvestment: String(trader.minInvestment),
    performanceFeePct: String((trader.performanceFeeBps ?? 1000) / 100),
    maxInvestors: String(trader.maxInvestors ?? 180),
    sortOrder: String(trader.sortOrder),
    isActive: trader.isActive,
    isVisible: trader.isVisible,
    isFeatured: trader.isFeatured,
    simulationEnabled: trader.simulationEnabled,
    simulationMinPct: String(trader.simulationMinBps / 100),
    simulationMaxPct: String(trader.simulationMaxBps / 100),
    simulationIntervalHours: String(trader.simulationIntervalHours),
  };
}

function formPayload(form: TraderForm) {
  return {
    name: form.name,
    photoUrl: form.photoUrl || null,
    description: form.description,
    riskLevel: form.riskLevel,
    experienceDays: Math.trunc(Number(form.experienceDays) || 0),
    followersCount: Math.trunc(Number(form.followersCount) || 0),
    minInvestment: Number(form.minInvestment) || 0,
    performanceFeeBps: Math.round((Number(form.performanceFeePct) || 0) * 100),
    maxInvestors: Math.max(1, Math.trunc(Number(form.maxInvestors) || 180)),
    sortOrder: Math.trunc(Number(form.sortOrder) || 0),
    isActive: form.isActive,
    isVisible: form.isVisible,
    isFeatured: form.isFeatured,
    simulationEnabled: form.simulationEnabled,
    simulationMinBps: Math.round((Number(form.simulationMinPct) || 0) * 100),
    simulationMaxBps: Math.round((Number(form.simulationMaxPct) || 0) * 100),
    simulationIntervalHours: Math.trunc(
      Number(form.simulationIntervalHours) || 24,
    ),
  };
}

export default function AdminCopyTradingPage() {
  const { t } = useI18n();
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Trader | null | "new">(null);
  const [form, setForm] = React.useState<TraderForm>(EMPTY_FORM);
  const [returns, setReturns] = React.useState<Record<string, string>>({});
  const [traderSearch, setTraderSearch] = React.useState("");
  const [traderPage, setTraderPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [investFeePct, setInvestFeePct] = React.useState("0");
  const [withdrawFeePct, setWithdrawFeePct] = React.useState("0");
  const [cutoffHour, setCutoffHour] = React.useState("22");

  const TRADER_PAGE_SIZE = 15;

  const filteredTraders = React.useMemo(() => {
    const q = traderSearch.trim().toLowerCase();
    const list = data?.traders ?? [];
    if (!q) return list;
    return list.filter((tr) => tr.name.toLowerCase().includes(q));
  }, [data?.traders, traderSearch]);

  const traderPageCount = Math.max(
    1,
    Math.ceil(filteredTraders.length / TRADER_PAGE_SIZE),
  );
  const pagedTraders = React.useMemo(
    () =>
      filteredTraders.slice(
        (traderPage - 1) * TRADER_PAGE_SIZE,
        traderPage * TRADER_PAGE_SIZE,
      ),
    [filteredTraders, traderPage],
  );

  React.useEffect(() => {
    setTraderPage(1);
    setSelectedIds(new Set());
  }, [traderSearch]);

  React.useEffect(() => {
    if (traderPage > traderPageCount) setTraderPage(traderPageCount);
  }, [traderPage, traderPageCount]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = pagedTraders.every((trader) => next.has(trader.id));
      for (const trader of pagedTraders) {
        if (allSelected) next.delete(trader.id);
        else next.add(trader.id);
      }
      return next;
    });
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        t("admin.copyTrading.confirmDelete", { n: ids.length }),
      )
    ) {
      return;
    }
    setBusy("delete");
    try {
      const result = await apiFetch<{
        deleted: number;
        skipped: number;
      }>("/api/admin/copy/traders/delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      setSelectedIds(new Set());
      if (result.skipped > 0) {
        toast.success(
          t("admin.copyTrading.deletedWithSkipped", {
            deleted: result.deleted,
            skipped: result.skipped,
          }),
        );
      } else {
        toast.success(
          t("admin.copyTrading.deleted", { n: result.deleted }),
        );
      }
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const next = await apiFetch<Dashboard & { ok: boolean }>("/api/admin/copy");
      setData(next);
      if (next.config) {
        setInvestFeePct(String(next.config.investFeeBps / 100));
        setWithdrawFeePct(String(next.config.withdrawFeeBps / 100));
        setCutoffHour(String(next.config.settlementCutoffHour));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing("new");
  }

  function openEdit(trader: Trader) {
    setForm(traderToForm(trader));
    setEditing(trader);
  }

  async function saveTrader() {
    const current = editing;
    if (!current) return;
    const key = current === "new" ? "create" : current.id;
    setBusy(key);
    try {
      await apiFetch(
        current === "new"
          ? "/api/admin/copy/traders"
          : `/api/admin/copy/traders/${current.id}`,
        {
          method: current === "new" ? "POST" : "PATCH",
          body: JSON.stringify(formPayload(form)),
        },
      );
      toast.success(t("admin.copyTrading.saved"));
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function publishReturn(trader: Trader) {
    const pct = Number(returns[trader.id]);
    if (!Number.isFinite(pct) || pct < -100 || pct > 100) {
      toast.error(t("admin.copyTrading.invalidReturn"));
      return;
    }
    setBusy(`return:${trader.id}`);
    try {
      const result = await apiFetch<{ affected: number }>(
        `/api/admin/copy/traders/${trader.id}/performance`,
        {
          method: "POST",
          body: JSON.stringify({
            period: "TODAY",
            returnBps: Math.round(pct * 100),
            idempotencyKey: idempotencyKey(trader.id),
          }),
        },
      );
      toast.success(
        t("admin.copyTrading.returnApplied", { n: result.affected }),
      );
      setReturns((current) => ({ ...current, [trader.id]: "" }));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function runSimulation(traderId?: string) {
    const key = `run:${traderId ?? "all"}`;
    setBusy(key);
    try {
      const result = await apiFetch<{
        processed: number;
        affectedInvestments: number;
      }>("/api/admin/copy/simulate", {
        method: "POST",
        body: JSON.stringify(traderId ? { traderId } : {}),
      });
      toast.success(
        t("admin.copyTrading.simulationApplied", {
          traders: result.processed,
          investments: result.affectedInvestments,
        }),
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

  async function decideWithdrawal(id: string, decision: "APPROVE" | "REJECT") {
    setBusy(`withdrawal:${id}`);
    try {
      await apiFetch(`/api/admin/copy/withdrawals/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      toast.success(t("admin.copyTrading.withdrawalUpdated"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveFees() {
    setBusy("config");
    try {
      await apiFetch("/api/admin/copy/config", {
        method: "PATCH",
        body: JSON.stringify({
          investFeeBps: Math.round((Number(investFeePct) || 0) * 100),
          withdrawFeeBps: Math.round((Number(withdrawFeePct) || 0) * 100),
          settlementCutoffHour: Math.min(
            23,
            Math.max(0, Math.trunc(Number(cutoffHour) || 22)),
          ),
          withdrawalMode: "INSTANT",
        }),
      });
      toast.success(t("admin.copyTrading.feesSaved"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.copyTrading.title")}
        subtitle={t("admin.copyTrading.subtitle")}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={busy === "run:all"}
              onClick={() => void runSimulation()}
            >
              <Play className="h-3.5 w-3.5" />
              {t("admin.copyTrading.runAll")}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              {t("admin.copyTrading.newTrader")}
            </Button>
          </div>
        }
      />

      <Card className="border-gold/25 bg-gold/5">
        <CardContent className="flex gap-3 p-4 text-sm text-text-secondary">
          <Bot className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <p>{t("admin.copyTrading.simulationNotice")}</p>
        </CardContent>
      </Card>

      {loading || !data ? (
        <p className="py-12 text-center text-sm text-text-muted">
          {t("common.loading")}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={t("admin.copyTrading.activeTraders")}
              value={String(data.metrics.activeTraders)}
            />
            <Metric
              label={t("admin.copyTrading.automated")}
              value={String(data.metrics.automatedTraders)}
            />
            <Metric
              label={t("admin.copyTrading.activeCopiers")}
              value={String(data.metrics.activeUsers)}
            />
            <Metric
              label={t("admin.copyTrading.connectedCapital")}
              value={`$${formatNumber(data.metrics.currentValue, { decimals: 2 })}`}
              tone="gold"
            />
            <Metric
              label={t("admin.copyTrading.platformPnl")}
              value={`${data.metrics.totalPnl >= 0 ? "+" : ""}$${formatNumber(data.metrics.totalPnl, { decimals: 2 })}`}
              tone={data.metrics.totalPnl >= 0 ? "positive" : "negative"}
            />
            <Metric
              label={t("admin.copyTrading.pendingWithdrawals")}
              value={String(data.metrics.pendingWithdrawals)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.feesTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <Field label={t("admin.copyTrading.investFee")}>
                <Input
                  type="number"
                  step="0.1"
                  value={investFeePct}
                  onChange={(e) => setInvestFeePct(e.target.value)}
                />
              </Field>
              <Field label={t("admin.copyTrading.withdrawFee")}>
                <Input
                  type="number"
                  step="0.1"
                  value={withdrawFeePct}
                  onChange={(e) => setWithdrawFeePct(e.target.value)}
                />
              </Field>
              <Field label={t("admin.copyTrading.cutoffHour")}>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={cutoffHour}
                  onChange={(e) => setCutoffHour(e.target.value)}
                />
              </Field>
              <div className="flex items-end">
                <Button
                  size="sm"
                  loading={busy === "config"}
                  onClick={() => void saveFees()}
                >
                  {t("admin.copyTrading.saveFees")}
                </Button>
              </div>
              <p className="sm:col-span-4 text-xs text-text-muted">
                {t("admin.copyTrading.feesHint")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-gold" />
                {t("admin.copyTrading.traders")}
                <span className="font-mono text-xs font-normal text-text-muted">
                  ({filteredTraders.length})
                </span>
              </CardTitle>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <div className="w-full sm:w-64">
                  <Input
                    value={traderSearch}
                    onChange={(e) => setTraderSearch(e.target.value)}
                    placeholder={t("admin.copyTrading.searchTraders")}
                  />
                </div>
                {selectedIds.size > 0 ? (
                  <Button
                    size="sm"
                    variant="danger"
                    loading={busy === "delete"}
                    onClick={() => void deleteSelected()}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("admin.copyTrading.deleteSelected", {
                      n: selectedIds.size,
                    })}
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {pagedTraders.length > 0 ? (
                <label className="flex items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={
                      pagedTraders.length > 0 &&
                      pagedTraders.every((trader) => selectedIds.has(trader.id))
                    }
                    onChange={toggleSelectPage}
                  />
                  {t("admin.copyTrading.selectPage")}
                </label>
              ) : null}
              {pagedTraders.map((trader) =>
                (() => {
                  const operation = data.openOperations.find(
                    (item) => item.traderId === trader.id,
                  );
                  return (
                    <div
                      key={trader.id}
                      className="rounded-lg border border-border-subtle bg-bg-base/40 p-4"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                        <label className="flex shrink-0 items-start pt-1">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(trader.id)}
                            onChange={() => toggleSelected(trader.id)}
                          />
                        </label>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-display font-semibold text-text-primary">
                              {trader.name}
                            </p>
                            <Badge
                              variant={
                                trader.riskLevel === "HIGH"
                                  ? "danger"
                                  : trader.riskLevel === "LOW"
                                    ? "success"
                                    : "warning"
                              }
                            >
                              {trader.riskLevel}
                            </Badge>
                            {trader.isFeatured ? (
                              <Badge variant="gold">
                                {t("admin.copyTrading.featured")}
                              </Badge>
                            ) : null}
                            {trader.simulationEnabled ? (
                              <Badge variant="info">
                                <Bot className="h-3 w-3" />
                                {t("admin.copyTrading.automatic")}
                              </Badge>
                            ) : null}
                            {!trader.isVisible ? (
                              <Badge variant="outline">
                                {t("admin.copyTrading.hidden")}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs text-text-muted">
                            {trader.description}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-text-secondary">
                            <span>
                              ROI {trader.roiBps >= 0 ? "+" : ""}
                              {(trader.roiBps / 100).toFixed(2)}%
                            </span>
                            <span>
                              {trader.activeInvestments}{" "}
                              {t("admin.copyTrading.copies")}
                            </span>
                            <span>
                              AUM ${formatNumber(trader.aum, { decimals: 0 })}
                            </span>
                            {trader.simulationEnabled ? (
                              <span>
                                {(trader.simulationMinBps / 100).toFixed(2)}%…+
                                {(trader.simulationMaxBps / 100).toFixed(2)}% /{" "}
                                {trader.simulationIntervalHours}h
                              </span>
                            ) : null}
                          </div>
                          {operation ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-info/20 bg-info/5 px-3 py-2 font-mono text-xs">
                              <Badge variant="info">SIM · OPEN</Badge>
                              <span
                                className={
                                  operation.direction === "LONG"
                                    ? "text-success"
                                    : "text-danger"
                                }
                              >
                                {operation.symbol} {operation.direction}{" "}
                                {operation.leverage}×
                              </span>
                              <span className="text-text-muted">
                                {formatNumber(operation.entryPrice, {
                                  decimals: operation.entryPrice < 10 ? 4 : 2,
                                })}
                                {" → "}
                                {formatNumber(operation.markPrice, {
                                  decimals: operation.markPrice < 10 ? 4 : 2,
                                })}
                              </span>
                              <span
                                className={
                                  operation.floatingReturnBps >= 0
                                    ? "text-success"
                                    : "text-danger"
                                }
                              >
                                {operation.floatingReturnBps >= 0 ? "+" : ""}
                                {(operation.floatingReturnBps / 100).toFixed(2)}
                                %
                              </span>
                              <span className="text-text-muted">
                                {new Date(operation.closesAt).toLocaleString()}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={t(
                              "admin.copyTrading.returnPlaceholder",
                            )}
                            value={returns[trader.id] ?? ""}
                            onChange={(event) =>
                              setReturns((current) => ({
                                ...current,
                                [trader.id]: event.target.value,
                              }))
                            }
                            className="w-28"
                          />
                          <Button
                            size="sm"
                            variant="success"
                            loading={busy === `return:${trader.id}`}
                            onClick={() => void publishReturn(trader)}
                          >
                            {t("admin.copyTrading.publish")}
                          </Button>
                          {trader.simulationEnabled ? (
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busy === `run:${trader.id}`}
                              onClick={() => void runSimulation(trader.id)}
                            >
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => openEdit(trader)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })(),
              )}
              {filteredTraders.length === 0 ? (
                <p className="text-sm text-text-muted">
                  {t("admin.copyTrading.noTradersMatch")}
                </p>
              ) : null}
              {traderPageCount > 1 ? (
                <div className="flex items-center justify-between border-t border-border-subtle pt-4">
                  <p className="font-mono text-xs text-text-muted">
                    {t("admin.copyTrading.pageOf", {
                      page: traderPage,
                      total: traderPageCount,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={traderPage <= 1}
                      onClick={() => setTraderPage((p) => Math.max(1, p - 1))}
                    >
                      {t("admin.copyTrading.prev")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={traderPage >= traderPageCount}
                      onClick={() =>
                        setTraderPage((p) => Math.min(traderPageCount, p + 1))
                      }
                    >
                      {t("admin.copyTrading.next")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("admin.copyTrading.pendingWithdrawals")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.pendingWithdrawals.length === 0 ? (
                  <p className="text-sm text-text-muted">
                    {t("admin.copyTrading.noPendingWithdrawals")}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <thead>
                        <THeadRow>
                          <TH>{t("common.user")}</TH>
                          <TH>{t("admin.copyTrading.trader")}</TH>
                          <TH className="text-right">
                            {t("admin.copyTrading.amount")}
                          </TH>
                          <TH />
                        </THeadRow>
                      </thead>
                      <TBody>
                        {data.pendingWithdrawals.map((withdrawal) => (
                          <TR key={withdrawal.id}>
                            <TD>
                              <p className="text-sm text-text-primary">
                                {withdrawal.userName}
                              </p>
                              <p className="font-mono text-xs text-text-muted">
                                {shortenAddress(withdrawal.walletAddress)}
                              </p>
                            </TD>
                            <TD>{withdrawal.traderName}</TD>
                            <TD className="text-right font-mono">
                              $
                              {formatNumber(withdrawal.amount, { decimals: 2 })}
                            </TD>
                            <TD>
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="success"
                                  disabled={
                                    busy === `withdrawal:${withdrawal.id}`
                                  }
                                  onClick={() =>
                                    void decideWithdrawal(
                                      withdrawal.id,
                                      "APPROVE",
                                    )
                                  }
                                >
                                  {t("admin.copyTrading.approve")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  disabled={
                                    busy === `withdrawal:${withdrawal.id}`
                                  }
                                  onClick={() =>
                                    void decideWithdrawal(
                                      withdrawal.id,
                                      "REJECT",
                                    )
                                  }
                                >
                                  {t("admin.copyTrading.reject")}
                                </Button>
                              </div>
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
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-gold" />
                  {t("admin.copyTrading.recentActivity")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentEvents.length === 0 ? (
                  <p className="text-sm text-text-muted">
                    {t("admin.copyTrading.noActivity")}
                  </p>
                ) : (
                  data.recentEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between border-b border-border-subtle pb-3 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {event.traderName}
                        </p>
                        <p className="text-xs text-text-muted">
                          {event.source === "SIMULATION"
                            ? t("admin.copyTrading.automatic")
                            : t("admin.copyTrading.manual")}{" "}
                          · {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </div>
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
          </div>
        </>
      )}

      <TraderDialog
        open={editing !== null}
        form={form}
        setForm={setForm}
        isNew={editing === "new"}
        saving={
          busy === "create" ||
          (editing !== null && editing !== "new" && busy === editing.id)
        }
        onClose={() => setEditing(null)}
        onSave={() => void saveTrader()}
      />
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
        <p className={`mt-1 font-mono text-xl font-semibold ${color}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function TraderDialog({
  open,
  form,
  setForm,
  isNew,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  form: TraderForm;
  setForm: React.Dispatch<React.SetStateAction<TraderForm>>;
  isNew: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const update = <K extends keyof TraderForm>(key: K, value: TraderForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isNew
              ? t("admin.copyTrading.newTrader")
              : t("admin.copyTrading.editTrader")}
          </DialogTitle>
          <DialogDescription>
            {t("admin.copyTrading.formDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.copyTrading.name")}>
              <Input
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </Field>
            <Field label={t("admin.copyTrading.risk")}>
              <Select
                value={form.riskLevel}
                onChange={(event) =>
                  update("riskLevel", event.target.value as Risk)
                }
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </Select>
            </Field>
          </div>
          <Field label={t("admin.copyTrading.description")}>
            <textarea
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none"
            />
          </Field>
          <Field label={t("admin.copyTrading.photoUrl")}>
            <Input
              value={form.photoUrl}
              onChange={(event) => update("photoUrl", event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Field label={t("admin.copyTrading.experienceDays")}>
              <Input
                type="number"
                value={form.experienceDays}
                onChange={(event) =>
                  update("experienceDays", event.target.value)
                }
              />
            </Field>
            <Field label={t("admin.copyTrading.followers")}>
              <Input
                type="number"
                value={form.followersCount}
                onChange={(event) =>
                  update("followersCount", event.target.value)
                }
              />
            </Field>
            <Field label={t("admin.copyTrading.minimum")}>
              <Input
                type="number"
                value={form.minInvestment}
                onChange={(event) =>
                  update("minInvestment", event.target.value)
                }
              />
            </Field>
            <Field label={t("admin.copyTrading.performanceFee")}>
              <Input
                type="number"
                step="0.1"
                value={form.performanceFeePct}
                onChange={(event) =>
                  update("performanceFeePct", event.target.value)
                }
              />
            </Field>
            <Field label={t("admin.copyTrading.maxInvestors")}>
              <Input
                type="number"
                value={form.maxInvestors}
                onChange={(event) =>
                  update("maxInvestors", event.target.value)
                }
              />
            </Field>
            <Field label={t("admin.copyTrading.order")}>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(event) => update("sortOrder", event.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Check
              label={t("admin.copyTrading.active")}
              checked={form.isActive}
              onChange={(value) => update("isActive", value)}
            />
            <Check
              label={t("admin.copyTrading.visible")}
              checked={form.isVisible}
              onChange={(value) => update("isVisible", value)}
            />
            <Check
              label={t("admin.copyTrading.featured")}
              checked={form.isFeatured}
              onChange={(value) => update("isFeatured", value)}
            />
          </div>
          <div className="rounded-lg border border-gold/20 bg-gold/5 p-4">
            <Check
              label={t("admin.copyTrading.enableAutomation")}
              checked={form.simulationEnabled}
              onChange={(value) => update("simulationEnabled", value)}
            />
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Field label={t("admin.copyTrading.minimumReturn")}>
                <Input
                  type="number"
                  step="0.01"
                  value={form.simulationMinPct}
                  onChange={(event) =>
                    update("simulationMinPct", event.target.value)
                  }
                />
              </Field>
              <Field label={t("admin.copyTrading.maximumReturn")}>
                <Input
                  type="number"
                  step="0.01"
                  value={form.simulationMaxPct}
                  onChange={(event) =>
                    update("simulationMaxPct", event.target.value)
                  }
                />
              </Field>
              <Field label={t("admin.copyTrading.intervalHours")}>
                <Input
                  type="number"
                  value={form.simulationIntervalHours}
                  onChange={(event) =>
                    update("simulationIntervalHours", event.target.value)
                  }
                />
              </Field>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={onSave}>
            {t("admin.copyTrading.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm text-text-secondary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-gold"
      />
      {label}
    </label>
  );
}
