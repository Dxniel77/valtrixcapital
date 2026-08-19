"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Pencil,
  Plus,
  Star,
  Trash2,
  Users,
} from "lucide-react";
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
import { COPY_RISK_PROFILES } from "@/lib/copy-trading/risk-profiles";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/utils";

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
  showcaseCopiers: number;
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder: number;
  simulationEnabled: boolean;
  simulationMinBps: number;
  simulationMaxBps: number;
  simulationIntervalHours: number;
  simulationMinOpsPerDay: number;
  simulationMaxOpsPerDay: number;
  simulationDurationMinMinutes: number;
  simulationDurationMaxMinutes: number;
  simulationLastRunAt: string | null;
  simulationNextRunAt: string | null;
  nextOperationAt: string | null;
  winProbBps?: number;
  lossProbBps?: number;
  targetMode?: boolean;
  monthlyTargetBps?: number;
  targetCycleDays?: number;
  copierPrincipal: number;
  copierValue: number;
  copierPnl: number;
  lastReturnBps: number | null;
  lastReturnAt: string | null;
};

type CopierFilter = "copiers" | "empty" | "all";
type FlagFilter = "all" | "featured" | "hidden" | "visible";
type TraderSort = "aum" | "copiers" | "pnl" | "last" | "name";

type Dashboard = {
  config?: {
    investFeeBps: number;
    withdrawFeeBps: number;
    globalMinInvestment: number;
    performanceFeeNetworkBps?: number[];
    openFeeBps?: number;
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
    companyFees: number;
    networkCommissions?: number;
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
  showcaseCopiers: string;
  sortOrder: string;
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  simulationEnabled: boolean;
  simulationMinPct: string;
  simulationMaxPct: string;
  simulationMinOpsPerDay: string;
  simulationMaxOpsPerDay: string;
  simulationDurationMinMinutes: string;
  simulationDurationMaxMinutes: string;
  winProbPct: string;
  lossProbPct: string;
  targetMode: boolean;
  monthlyTargetPct: string;
  targetCycleDays: string;
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
  showcaseCopiers: "20",
  sortOrder: "0",
  isActive: true,
  isVisible: true,
  isFeatured: false,
  simulationEnabled: true,
  simulationMinPct: "-0.5",
  simulationMaxPct: "1",
  simulationMinOpsPerDay: "8",
  simulationMaxOpsPerDay: "20",
  simulationDurationMinMinutes: "4",
  simulationDurationMaxMinutes: "8",
  winProbPct: "60",
  lossProbPct: "40",
  targetMode: false,
  monthlyTargetPct: "6",
  targetCycleDays: "30",
};

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
    showcaseCopiers: String(trader.showcaseCopiers ?? 0),
    sortOrder: String(trader.sortOrder),
    isActive: trader.isActive,
    isVisible: trader.isVisible,
    isFeatured: trader.isFeatured,
    simulationEnabled: trader.simulationEnabled,
    simulationMinPct: String(trader.simulationMinBps / 100),
    simulationMaxPct: String(trader.simulationMaxBps / 100),
    simulationMinOpsPerDay: String(trader.simulationMinOpsPerDay ?? 8),
    simulationMaxOpsPerDay: String(trader.simulationMaxOpsPerDay ?? 20),
    simulationDurationMinMinutes: String(trader.simulationDurationMinMinutes ?? 3),
    simulationDurationMaxMinutes: String(trader.simulationDurationMaxMinutes ?? 10),
    winProbPct: String(((trader.winProbBps ?? 6000) / 100).toFixed(0)),
    lossProbPct: String(((trader.lossProbBps ?? 4000) / 100).toFixed(0)),
    targetMode: trader.targetMode ?? false,
    monthlyTargetPct: String(((trader.monthlyTargetBps ?? 0) / 100).toFixed(1)),
    targetCycleDays: String(trader.targetCycleDays ?? 30),
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
    showcaseCopiers: Math.max(
      0,
      Math.min(200, Math.trunc(Number(form.showcaseCopiers) || 0)),
    ),
    sortOrder: Math.trunc(Number(form.sortOrder) || 0),
    isActive: form.isActive,
    isVisible: form.isVisible,
    isFeatured: form.isFeatured,
    simulationEnabled: form.simulationEnabled,
    simulationMinBps: Math.round((Number(form.simulationMinPct) || 0) * 100),
    simulationMaxBps: Math.round((Number(form.simulationMaxPct) || 0) * 100),
    simulationMinOpsPerDay: Math.max(
      1,
      Math.trunc(Number(form.simulationMinOpsPerDay) || 8),
    ),
    simulationMaxOpsPerDay: Math.max(
      1,
      Math.trunc(Number(form.simulationMaxOpsPerDay) || 20),
    ),
    simulationDurationMinMinutes: Math.max(
      1,
      Math.trunc(Number(form.simulationDurationMinMinutes) || 3),
    ),
    simulationDurationMaxMinutes: Math.max(
      1,
      Math.trunc(Number(form.simulationDurationMaxMinutes) || 10),
    ),
    winProbBps: Math.max(
      0,
      Math.min(10_000, Math.round((Number(form.winProbPct) || 0) * 100)),
    ),
    lossProbBps: Math.max(
      0,
      Math.min(10_000, Math.round((Number(form.lossProbPct) || 0) * 100)),
    ),
    targetMode: form.targetMode,
    monthlyTargetBps: Math.round((Number(form.monthlyTargetPct) || 0) * 100),
    targetCycleDays: Math.min(
      90,
      Math.max(1, Math.trunc(Number(form.targetCycleDays) || 30)),
    ),
  };
}

/** Traders shown per admin list page. */
const TRADER_PAGE_SIZE = 25;
/** Bulk range UI kept for later; set true to show again. */
const SHOW_BULK_SHOWCASE_COPIERS = false;

export default function AdminCopyTradingPage() {
  const { t } = useI18n();
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Trader | null | "new">(null);
  const [form, setForm] = React.useState<TraderForm>(EMPTY_FORM);
  const [traderSearch, setTraderSearch] = React.useState("");
  const [traderPage, setTraderPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [copierFilter, setCopierFilter] = React.useState<CopierFilter>("copiers");
  const [flagFilter, setFlagFilter] = React.useState<FlagFilter>("all");
  const [traderSort, setTraderSort] = React.useState<TraderSort>("aum");
  const [investFeePct, setInvestFeePct] = React.useState("0");
  const [withdrawFeePct, setWithdrawFeePct] = React.useState("0");
  const [openFeePct, setOpenFeePct] = React.useState("0.05");
  const [networkPcts, setNetworkPcts] = React.useState([
    "30",
    "15",
    "10",
    "5",
    "5",
    "5",
  ]);
  const [showcaseMin, setShowcaseMin] = React.useState("15");
  const [showcaseMax, setShowcaseMax] = React.useState("90");

  const filteredTraders = React.useMemo(() => {
    const q = traderSearch.trim().toLowerCase();
    let list = data?.traders ?? [];
    if (copierFilter === "copiers") {
      list = list.filter((tr) => tr.activeInvestments > 0);
    } else if (copierFilter === "empty") {
      list = list.filter((tr) => tr.activeInvestments === 0);
    }
    if (flagFilter === "featured") {
      list = list.filter((tr) => tr.isFeatured);
    } else if (flagFilter === "hidden") {
      list = list.filter((tr) => !tr.isVisible);
    } else if (flagFilter === "visible") {
      list = list.filter((tr) => tr.isVisible);
    }
    if (q) {
      list = list.filter((tr) => tr.name.toLowerCase().includes(q));
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (traderSort === "copiers") return b.activeInvestments - a.activeInvestments;
      if (traderSort === "pnl") return (b.copierPnl ?? 0) - (a.copierPnl ?? 0);
      if (traderSort === "last") return (b.lastReturnBps ?? -99999) - (a.lastReturnBps ?? -99999);
      if (traderSort === "name") return a.name.localeCompare(b.name);
      return (b.copierValue ?? b.aum) - (a.copierValue ?? a.aum);
    });
    return sorted;
  }, [data?.traders, traderSearch, copierFilter, flagFilter, traderSort]);

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
  }, [traderSearch, copierFilter, flagFilter, traderSort]);

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

  async function deleteTraders(ids: string[], busyKey: string) {
    if (ids.length === 0) return;
    setBusy(busyKey);
    try {
      const result = await apiFetch<{
        deleted: number;
        refunded: number;
        refundedAmount: number;
      }>("/api/admin/copy/traders/delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      setSelectedIds(new Set());
      toast.success(
        t("admin.copyTrading.deleted", {
          n: result.deleted,
          refunded: result.refunded,
          amount: formatNumber(result.refundedAmount, { decimals: 2 }),
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

  async function deleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (
      !window.confirm(t("admin.copyTrading.confirmDelete", { n: ids.length }))
    ) {
      return;
    }
    await deleteTraders(ids, "delete");
  }

  async function deleteOne(trader: Trader) {
    if (
      !window.confirm(
        t("admin.copyTrading.confirmDeleteOne", { name: trader.name }),
      )
    ) {
      return;
    }
    await deleteTraders([trader.id], `delete:${trader.id}`);
  }

  async function patchFlags(
    trader: Trader,
    flags: { isFeatured?: boolean; isVisible?: boolean },
  ) {
    const key = `flags:${trader.id}`;
    setBusy(key);
    try {
      const result = await apiFetch<{ trader: Trader }>(
        `/api/admin/copy/traders/${trader.id}/flags`,
        {
          method: "PATCH",
          body: JSON.stringify(flags),
        },
      );
      setData((current) =>
        current
          ? {
              ...current,
              traders: current.traders.map((row) =>
                row.id === trader.id
                  ? {
                      ...row,
                      isFeatured: result.trader.isFeatured,
                      isVisible: result.trader.isVisible,
                      isActive: result.trader.isActive,
                    }
                  : row,
              ),
            }
          : current,
      );
      if (flags.isFeatured !== undefined) {
        toast.success(
          flags.isFeatured
            ? t("admin.copyTrading.featuredOn")
            : t("admin.copyTrading.featuredOff"),
        );
      } else if (flags.isVisible !== undefined) {
        toast.success(
          flags.isVisible
            ? t("admin.copyTrading.visibleOn")
            : t("admin.copyTrading.visibleOff"),
        );
      }
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
        setOpenFeePct(
          String(((next.config.openFeeBps ?? 5) / 100).toFixed(2)),
        );
        if (next.config.performanceFeeNetworkBps?.length === 6) {
          setNetworkPcts(
            next.config.performanceFeeNetworkBps.map((bps) =>
              String(bps / 100),
            ),
          );
        }
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

  async function saveFees() {
    setBusy("config");
    try {
      await apiFetch("/api/admin/copy/config", {
        method: "PATCH",
        body: JSON.stringify({
          investFeeBps: Math.round((Number(investFeePct) || 0) * 100),
          withdrawFeeBps: Math.round((Number(withdrawFeePct) || 0) * 100),
          openFeeBps: Math.round((Number(openFeePct) || 0) * 100),
          performanceFeeNetworkBps: networkPcts.map((value) =>
            Math.max(0, Math.round((Number(value) || 0) * 100)),
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

  async function applyShowcaseRange() {
    const min = Math.trunc(Number(showcaseMin));
    const max = Math.trunc(Number(showcaseMax));
    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min < 0 ||
      max > 200 ||
      min > max
    ) {
      toast.error(t("admin.copyTrading.showcaseRangeInvalid"));
      return;
    }
    if (
      !window.confirm(
        t("admin.copyTrading.showcaseRangeConfirm", { min, max }),
      )
    ) {
      return;
    }

    setBusy("showcase-range");
    try {
      const result = await apiFetch<{ updated: number }>(
        "/api/admin/copy/traders/showcase",
        {
          method: "POST",
          body: JSON.stringify({ min, max }),
        },
      );
      toast.success(
        t("admin.copyTrading.showcaseRangeApplied", { n: result.updated }),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.copyTrading.title")}
        subtitle={t("admin.copyTrading.subtitle")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/copy-trading/live">
                <Activity className="h-3.5 w-3.5" />
                {t("admin.copyTrading.liveBoard")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/copy-trading/income">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {t("admin.copyTrading.incomeReports")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/copy-trading/copiers">
                <Users className="h-3.5 w-3.5" />
                {t("admin.copyTrading.allCopiers")}
              </Link>
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
              label={t("admin.copyTrading.companyIncome")}
              value={`$${formatNumber(data.metrics.companyFees ?? 0, { decimals: 2 })}`}
              tone="gold"
            />
          </div>
          {data.metrics.networkCommissions ? (
            <p className="text-xs text-text-muted">
              {t("admin.copyTrading.networkPaid", {
                amount: formatNumber(data.metrics.networkCommissions, {
                  decimals: 2,
                }),
              })}
            </p>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.feesTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
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
              <Field label={t("admin.copyTrading.openFee")}>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={openFeePct}
                  onChange={(e) => setOpenFeePct(e.target.value)}
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
              <p className="sm:col-span-3 xl:col-span-6 text-xs text-text-muted">
                {t("admin.copyTrading.feesHint")}
              </p>
              <div className="sm:col-span-3 xl:col-span-6 grid gap-3 sm:grid-cols-6">
                {networkPcts.map((value, index) => (
                  <Field
                    key={`network-l${index + 1}`}
                    label={t("admin.copyTrading.networkLevel", {
                      n: index + 1,
                    })}
                  >
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={value}
                      onChange={(event) =>
                        setNetworkPcts((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                    />
                  </Field>
                ))}
              </div>
              <p className="sm:col-span-3 xl:col-span-6 text-xs text-text-muted">
                {t("admin.copyTrading.networkHint")}
              </p>
            </CardContent>
          </Card>

          {SHOW_BULK_SHOWCASE_COPIERS ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("admin.copyTrading.showcaseRangeTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t("admin.copyTrading.showcaseMin")}>
                    <Input
                      type="number"
                      min={0}
                      max={200}
                      value={showcaseMin}
                      onChange={(event) => setShowcaseMin(event.target.value)}
                    />
                  </Field>
                  <Field label={t("admin.copyTrading.showcaseMax")}>
                    <Input
                      type="number"
                      min={0}
                      max={200}
                      value={showcaseMax}
                      onChange={(event) => setShowcaseMax(event.target.value)}
                    />
                  </Field>
                  <div className="flex items-end">
                    <Button
                      loading={busy === "showcase-range"}
                      onClick={() => void applyShowcaseRange()}
                    >
                      {t("admin.copyTrading.applyShowcaseRange")}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-text-muted">
                  {t("admin.copyTrading.showcaseRangeHint")}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-gold" />
                  {t("admin.copyTrading.traders")}
                  <span className="font-mono text-xs font-normal text-text-muted">
                    ({filteredTraders.length})
                  </span>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
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
              </div>
              <div className="flex flex-col gap-2 lg:flex-row">
                <Select
                  value={copierFilter}
                  onChange={(e) =>
                    setCopierFilter(e.target.value as CopierFilter)
                  }
                >
                  <option value="copiers">
                    {t("admin.copyTrading.filterCopiers")}
                  </option>
                  <option value="empty">
                    {t("admin.copyTrading.filterEmpty")}
                  </option>
                  <option value="all">{t("admin.copyTrading.filterAll")}</option>
                </Select>
                <Select
                  value={flagFilter}
                  onChange={(e) => setFlagFilter(e.target.value as FlagFilter)}
                >
                  <option value="all">
                    {t("admin.copyTrading.filterFlagsAll")}
                  </option>
                  <option value="featured">
                    {t("admin.copyTrading.filterFeatured")}
                  </option>
                  <option value="visible">
                    {t("admin.copyTrading.filterVisible")}
                  </option>
                  <option value="hidden">
                    {t("admin.copyTrading.filterHidden")}
                  </option>
                </Select>
                <Select
                  value={traderSort}
                  onChange={(e) => setTraderSort(e.target.value as TraderSort)}
                >
                  <option value="aum">{t("admin.copyTrading.sortAum")}</option>
                  <option value="copiers">
                    {t("admin.copyTrading.sortCopiers")}
                  </option>
                  <option value="pnl">{t("admin.copyTrading.sortPnl")}</option>
                  <option value="last">{t("admin.copyTrading.sortLast")}</option>
                  <option value="name">{t("admin.copyTrading.sortName")}</option>
                </Select>
                <Input
                  value={traderSearch}
                  onChange={(e) => setTraderSearch(e.target.value)}
                  placeholder={t("admin.copyTrading.searchTraders")}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {pagedTraders.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <thead>
                      <THeadRow>
                        <TH>
                          <input
                            type="checkbox"
                            checked={
                              pagedTraders.length > 0 &&
                              pagedTraders.every((trader) =>
                                selectedIds.has(trader.id),
                              )
                            }
                            onChange={toggleSelectPage}
                          />
                        </TH>
                        <TH>{t("admin.copyTrading.trader")}</TH>
                        <TH className="text-right">
                          {t("admin.copyTrading.connectedCapital")}
                        </TH>
                        <TH className="text-right">
                          {t("admin.copyTrading.copies")}
                        </TH>
                        <TH className="text-right">{t("admin.copyTrading.pnl")}</TH>
                        <TH className="text-right">
                          {t("admin.copyTrading.lastResult")}
                        </TH>
                        <TH />
                      </THeadRow>
                    </thead>
                    <TBody>
                      {pagedTraders.map((trader) => (
                        <TR key={trader.id}>
                          <TD>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(trader.id)}
                              onChange={() => toggleSelected(trader.id)}
                            />
                          </TD>
                          <TD>
                            <p className="font-medium text-text-primary">
                              {trader.name}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge
                                variant={
                                  trader.riskLevel === "HIGH"
                                    ? "danger"
                                    : trader.riskLevel === "LOW"
                                      ? "success"
                                      : "warning"
                                }
                              >
                                {t(`admin.copyTrading.risk${trader.riskLevel}`)}
                              </Badge>
                              {trader.isFeatured ? (
                                <Badge variant="warning">
                                  {t("admin.copyTrading.featured")}
                                </Badge>
                              ) : null}
                              {!trader.isVisible ? (
                                <Badge variant="outline">
                                  {t("admin.copyTrading.hidden")}
                                </Badge>
                              ) : null}
                              {!trader.isActive ? (
                                <Badge variant="outline">
                                  {t("admin.copyTrading.inactive")}
                                </Badge>
                              ) : null}
                            </div>
                          </TD>
                          <TD className="text-right font-mono">
                            $
                            {formatNumber(trader.copierValue ?? trader.aum, {
                              decimals: 2,
                            })}
                          </TD>
                          <TD className="text-right font-mono">
                            {trader.activeInvestments}
                          </TD>
                          <TD
                            className={`text-right font-mono ${
                              (trader.copierPnl ?? 0) >= 0
                                ? "text-success"
                                : "text-danger"
                            }`}
                          >
                            {(trader.copierPnl ?? 0) >= 0 ? "+" : ""}$
                            {formatNumber(trader.copierPnl ?? 0, { decimals: 2 })}
                          </TD>
                          <TD
                            className={`text-right font-mono ${
                              (trader.lastReturnBps ?? 0) >= 0
                                ? "text-success"
                                : "text-danger"
                            }`}
                          >
                            {trader.lastReturnBps == null
                              ? "—"
                              : `${trader.lastReturnBps >= 0 ? "+" : ""}${(trader.lastReturnBps / 100).toFixed(2)}%`}
                          </TD>
                          <TD>
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                title={t("admin.copyTrading.toggleFeatured")}
                                loading={busy === `flags:${trader.id}`}
                                onClick={() =>
                                  void patchFlags(trader, {
                                    isFeatured: !trader.isFeatured,
                                  })
                                }
                              >
                                <Star
                                  className={`h-4 w-4 ${
                                    trader.isFeatured
                                      ? "fill-gold text-gold"
                                      : "text-text-muted"
                                  }`}
                                />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                title={t("admin.copyTrading.toggleVisible")}
                                loading={busy === `flags:${trader.id}`}
                                onClick={() =>
                                  void patchFlags(trader, {
                                    isVisible: !trader.isVisible,
                                  })
                                }
                              >
                                {trader.isVisible ? (
                                  <Eye className="h-4 w-4 text-text-muted" />
                                ) : (
                                  <EyeOff className="h-4 w-4 text-danger" />
                                )}
                              </Button>
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/admin/copy-trading/${trader.id}`}>
                                  {t("admin.copyTrading.openDesk")}
                                </Link>
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => openEdit(trader)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                loading={busy === `delete:${trader.id}`}
                                onClick={() => void deleteOne(trader)}
                              >
                                <Trash2 className="h-4 w-4 text-danger" />
                              </Button>
                            </div>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              ) : null}
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
                onChange={(event) => {
                  const risk = event.target.value as Risk;
                  const profile = COPY_RISK_PROFILES[risk];
                  setForm((current) => ({
                    ...current,
                    riskLevel: risk,
                    simulationDurationMinMinutes: String(
                      profile.durationMinMinutes,
                    ),
                    simulationDurationMaxMinutes: String(
                      profile.durationMaxMinutes,
                    ),
                  }));
                }}
              >
                <option value="LOW">{t("admin.copyTrading.riskLOW")}</option>
                <option value="MEDIUM">{t("admin.copyTrading.riskMEDIUM")}</option>
                <option value="HIGH">{t("admin.copyTrading.riskHIGH")}</option>
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
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-7">
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
            <Field label={t("admin.copyTrading.showcaseCopiers")}>
              <Input
                type="number"
                min="0"
                max="200"
                value={form.showcaseCopiers}
                onChange={(event) =>
                  update("showcaseCopiers", event.target.value)
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
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
              <Field label={t("admin.copyTrading.minOpsPerDay")}>
                <Input
                  type="number"
                  min={1}
                  max={48}
                  value={form.simulationMinOpsPerDay}
                  onChange={(event) =>
                    update("simulationMinOpsPerDay", event.target.value)
                  }
                />
              </Field>
              <Field label={t("admin.copyTrading.maxOpsPerDay")}>
                <Input
                  type="number"
                  min={1}
                  max={48}
                  value={form.simulationMaxOpsPerDay}
                  onChange={(event) =>
                    update("simulationMaxOpsPerDay", event.target.value)
                  }
                />
              </Field>
              <Field label={t("admin.copyTrading.durationMinMinutes")}>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={form.simulationDurationMinMinutes}
                  onChange={(event) =>
                    update("simulationDurationMinMinutes", event.target.value)
                  }
                />
              </Field>
              <Field label={t("admin.copyTrading.durationMaxMinutes")}>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={form.simulationDurationMaxMinutes}
                  onChange={(event) =>
                    update("simulationDurationMaxMinutes", event.target.value)
                  }
                />
              </Field>
              <Field label={t("admin.copyTrading.winProb")}>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  value={form.winProbPct}
                  onChange={(event) => update("winProbPct", event.target.value)}
                />
              </Field>
              <Field label={t("admin.copyTrading.lossProb")}>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  value={form.lossProbPct}
                  onChange={(event) => update("lossProbPct", event.target.value)}
                />
              </Field>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-end">
                <Check
                  label={t("admin.copyTrading.targetMode")}
                  checked={form.targetMode}
                  onChange={(value) => update("targetMode", value)}
                />
              </div>
              <Field label={t("admin.copyTrading.monthlyTarget")}>
                <Input
                  type="number"
                  step="0.5"
                  value={form.monthlyTargetPct}
                  onChange={(event) =>
                    update("monthlyTargetPct", event.target.value)
                  }
                />
              </Field>
              <Field label={t("admin.copyTrading.targetCycleDays")}>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={form.targetCycleDays}
                  onChange={(event) =>
                    update("targetCycleDays", event.target.value)
                  }
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {t("admin.copyTrading.targetHint")}
            </p>
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
