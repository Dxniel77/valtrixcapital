"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  Eye,
  EyeOff,
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
  copierPrincipal: number;
  copierValue: number;
  copierPnl: number;
  lastReturnBps: number | null;
  lastReturnAt: string | null;
};

type CopierFilter = "copiers" | "empty" | "all";
type FlagFilter = "all" | "featured" | "hidden" | "visible";
type TraderSort = "aum" | "copiers" | "pnl" | "last" | "name";
type TargetMode = "GROWTH" | "NEUTRAL" | "HARVEST";

type BulkTotals = {
  traders: number;
  eligible: number;
  skippedAfterCutoff: number;
  lossProtected: number;
  userDelta: number;
  companyFee: number;
  green: number;
  red: number;
  flat: number;
};

type TargetAllocation = {
  requestedUserDelta: number;
  achievedUserDelta: number;
  difference: number;
  reachable: boolean;
  minUserDelta: number;
  maxUserDelta: number;
  items: Array<{ traderId: string; returnBps: number }>;
  totals: BulkTotals;
};

type Dashboard = {
  config?: {
    investFeeBps: number;
    withdrawFeeBps: number;
    settlementCutoffHour: number;
    lossGraceDays: number;
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
    companyFees: number;
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

function suggestReturnBps(minBps: number, maxBps: number): number {
  if (minBps === maxBps) return minBps;
  const lo = Math.min(minBps, maxBps);
  const hi = Math.max(minBps, maxBps);
  const span = hi - lo;
  return Math.min(hi, Math.max(lo, lo + Math.round(span * (0.4 + Math.random() * 0.6))));
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
  const [copierFilter, setCopierFilter] = React.useState<CopierFilter>("copiers");
  const [flagFilter, setFlagFilter] = React.useState<FlagFilter>("all");
  const [traderSort, setTraderSort] = React.useState<TraderSort>("aum");
  const [bulkPreview, setBulkPreview] = React.useState<BulkTotals | null>(null);
  const [targetMode, setTargetMode] = React.useState<TargetMode>("HARVEST");
  const [targetAmount, setTargetAmount] = React.useState("100");
  const [targetAllocation, setTargetAllocation] =
    React.useState<TargetAllocation | null>(null);
  const [investFeePct, setInvestFeePct] = React.useState("0");
  const [withdrawFeePct, setWithdrawFeePct] = React.useState("0");
  const [cutoffHour, setCutoffHour] = React.useState("22");
  const [lossGraceDays, setLossGraceDays] = React.useState("2");

  const TRADER_PAGE_SIZE = 25;

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
    setBulkPreview(null);
    setTargetAllocation(null);
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
        setCutoffHour(String(next.config.settlementCutoffHour));
        setLossGraceDays(String(next.config.lossGraceDays ?? 2));
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

  function filledItems(traders: Trader[]) {
    const items: Array<{ traderId: string; returnBps: number; idempotencyKey: string }> =
      [];
    for (const trader of traders) {
      const pct = Number(returns[trader.id]);
      if (!Number.isFinite(pct) || pct < -100 || pct > 100) continue;
      items.push({
        traderId: trader.id,
        returnBps: Math.round(pct * 100),
        idempotencyKey: idempotencyKey(trader.id),
      });
    }
    return items;
  }

  function suggestDay() {
    const targets = filteredTraders.filter((trader) => trader.activeInvestments > 0);
    if (targets.length === 0) {
      toast.error(t("admin.copyTrading.noCopiersToSuggest"));
      return;
    }
    setReturns((current) => {
      const next = { ...current };
      for (const trader of targets) {
        next[trader.id] = (suggestReturnBps(trader.simulationMinBps, trader.simulationMaxBps) / 100).toFixed(2);
      }
      return next;
    });
    setBulkPreview(null);
    setTargetAllocation(null);
    toast.success(t("admin.copyTrading.suggested", { n: targets.length }));
  }

  async function allocateTarget() {
    const targets = filteredTraders.filter(
      (trader) => trader.activeInvestments > 0 && trader.isActive,
    );
    if (targets.length === 0) {
      toast.error(t("admin.copyTrading.noCopiersToSuggest"));
      return;
    }
    const amount = targetMode === "NEUTRAL" ? 0 : Number(targetAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error(t("admin.copyTrading.invalidTarget"));
      return;
    }

    setBusy("target");
    try {
      const result = await apiFetch<TargetAllocation>(
        "/api/admin/copy/performance/target",
        {
          method: "POST",
          body: JSON.stringify({
            traderIds: targets.map((trader) => trader.id),
            mode: targetMode,
            targetAmount: amount,
          }),
        },
      );
      setReturns((current) => {
        const next = { ...current };
        for (const item of result.items) {
          next[item.traderId] = (item.returnBps / 100).toFixed(2);
        }
        return next;
      });
      setBulkPreview(result.totals);
      setTargetAllocation(result);
      toast.success(
        t("admin.copyTrading.targetAllocated", {
          amount: formatNumber(result.achievedUserDelta, { decimals: 2 }),
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function previewAll() {
    const items = filledItems(filteredTraders);
    if (items.length === 0) {
      toast.error(t("admin.copyTrading.noResultsToPreview"));
      return;
    }
    setBusy("preview");
    try {
      const result = await apiFetch<{ totals: BulkTotals }>(
        "/api/admin/copy/performance/preview",
        { method: "POST", body: JSON.stringify({ items }) },
      );
      setBulkPreview(result.totals);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("errors.signInFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function publishAll() {
    const items = filledItems(filteredTraders);
    if (items.length === 0) {
      toast.error(t("admin.copyTrading.noResultsToPreview"));
      return;
    }
    if (!bulkPreview) {
      toast.error(t("admin.copyTrading.previewRequired"));
      return;
    }
    if (
      !window.confirm(
        t("admin.copyTrading.publishAllConfirm", {
          n: items.length,
          delta: formatNumber(bulkPreview?.userDelta ?? 0, { decimals: 2 }),
          fee: formatNumber(bulkPreview?.companyFee ?? 0, { decimals: 2 }),
        }),
      )
    ) {
      return;
    }
    setBusy("publish-all");
    try {
      const result = await apiFetch<{
        published: number;
        affected: number;
        failed: Array<{ traderId: string; error: string }>;
      }>("/api/admin/copy/performance/publish", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      if (result.failed.length > 0) {
        toast.error(
          t("admin.copyTrading.publishedWithErrors", {
            n: result.published,
            failed: result.failed.length,
          }),
        );
      } else {
        toast.success(
          t("admin.copyTrading.publishedAll", {
            n: result.published,
            affected: result.affected,
          }),
        );
      }
      setReturns({});
      setBulkPreview(null);
      setTargetAllocation(null);
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
          lossGraceDays: Math.min(
            30,
            Math.max(0, Math.trunc(Number(lossGraceDays) || 0)),
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.feesTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-5">
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
              <Field label={t("admin.copyTrading.lossGraceDays")}>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={lossGraceDays}
                  onChange={(e) => setLossGraceDays(e.target.value)}
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
              <p className="sm:col-span-5 text-xs text-text-muted">
                {t("admin.copyTrading.feesHint")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-gold/25">
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.copyTrading.bookTargetTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t("admin.copyTrading.bookMode")}>
                  <Select
                    value={targetMode}
                    onChange={(event) => {
                      setTargetMode(event.target.value as TargetMode);
                      setBulkPreview(null);
                      setTargetAllocation(null);
                    }}
                  >
                    <option value="GROWTH">
                      {t("admin.copyTrading.modeGrowth")}
                    </option>
                    <option value="NEUTRAL">
                      {t("admin.copyTrading.modeNeutral")}
                    </option>
                    <option value="HARVEST">
                      {t("admin.copyTrading.modeHarvest")}
                    </option>
                  </Select>
                </Field>
                <Field label={t("admin.copyTrading.targetAmount")}>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    disabled={targetMode === "NEUTRAL"}
                    value={targetMode === "NEUTRAL" ? "0" : targetAmount}
                    onChange={(event) => {
                      setTargetAmount(event.target.value);
                      setBulkPreview(null);
                      setTargetAllocation(null);
                    }}
                  />
                </Field>
                <div className="flex items-end">
                  <Button
                    loading={busy === "target"}
                    onClick={() => void allocateTarget()}
                  >
                    {t("admin.copyTrading.allocateTarget")}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-text-muted">
                {targetMode === "GROWTH"
                  ? t("admin.copyTrading.modeGrowthHint")
                  : targetMode === "NEUTRAL"
                    ? t("admin.copyTrading.modeNeutralHint")
                    : t("admin.copyTrading.modeHarvestHint")}
              </p>
              {targetAllocation ? (
                <div
                  className={`rounded-md border p-3 text-xs ${
                    targetAllocation.reachable
                      ? "border-success/25 bg-success/5"
                      : "border-warning/25 bg-warning/5"
                  }`}
                >
                  {t("admin.copyTrading.targetResult", {
                    requested: formatNumber(
                      targetAllocation.requestedUserDelta,
                      { decimals: 2 },
                    ),
                    achieved: formatNumber(
                      targetAllocation.achievedUserDelta,
                      { decimals: 2 },
                    ),
                  })}
                  {!targetAllocation.reachable
                    ? ` · ${t("admin.copyTrading.targetCapped", {
                        min: formatNumber(targetAllocation.minUserDelta, {
                          decimals: 2,
                        }),
                        max: formatNumber(targetAllocation.maxUserDelta, {
                          decimals: 2,
                        }),
                      })}`
                    : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={suggestDay}
                  >
                    {t("admin.copyTrading.randomDraft")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === "preview"}
                    onClick={() => void previewAll()}
                  >
                    {t("admin.copyTrading.previewAll")}
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    loading={busy === "publish-all"}
                    disabled={!bulkPreview}
                    onClick={() => void publishAll()}
                  >
                    {t("admin.copyTrading.publishAll")}
                  </Button>
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
              {bulkPreview ? (
                <div className="grid gap-2 rounded-md border border-gold/20 bg-gold/5 p-3 text-xs sm:grid-cols-5">
                  <span>
                    {t("admin.copyTrading.bulkTraders", {
                      n: bulkPreview.traders,
                    })}{" "}
                    · {t("admin.copyTrading.bulkGreen", { n: bulkPreview.green })}{" "}
                    / {t("admin.copyTrading.bulkRed", { n: bulkPreview.red })}
                  </span>
                  <span>
                    {t("admin.copyTrading.previewEligible", {
                      n: bulkPreview.eligible,
                    })}
                  </span>
                  <span className="text-info">
                    {t("admin.copyTrading.lossProtected", {
                      n: bulkPreview.lossProtected,
                    })}
                  </span>
                  <span
                    className={
                      bulkPreview.userDelta >= 0 ? "text-success" : "text-danger"
                    }
                  >
                    {t("admin.copyTrading.previewUserDelta")}:{" "}
                    {bulkPreview.userDelta >= 0 ? "+" : ""}$
                    {formatNumber(bulkPreview.userDelta, { decimals: 2 })}
                  </span>
                  <span className="text-gold">
                    {t("admin.copyTrading.previewCompanyFee")}: $
                    {formatNumber(bulkPreview.companyFee, { decimals: 2 })}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-text-muted">
                  {t("admin.copyTrading.bulkHint")}
                </p>
              )}
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
                        <TH>{t("admin.copyTrading.returnPlaceholder")}</TH>
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
                                {trader.riskLevel}
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
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                className="w-24"
                                placeholder={t(
                                  "admin.copyTrading.returnPlaceholder",
                                )}
                                value={returns[trader.id] ?? ""}
                                onChange={(event) => {
                                  setBulkPreview(null);
                                  setTargetAllocation(null);
                                  setReturns((current) => ({
                                    ...current,
                                    [trader.id]: event.target.value,
                                  }));
                                }}
                              />
                              <Button
                                size="sm"
                                variant="success"
                                loading={busy === `return:${trader.id}`}
                                onClick={() => void publishReturn(trader)}
                              >
                                {t("admin.copyTrading.publish")}
                              </Button>
                            </div>
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
