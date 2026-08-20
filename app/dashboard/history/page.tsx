"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpFromLine,
  Coins,
  Download,
  ExternalLink,
  Gift,
  LineChart,
  Search,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { PAIRS } from "@/lib/market/pairs";
import {
  downloadCsv,
  ledgerToCsv,
  useLedger,
  type LedgerCategory,
  type LedgerEntry,
} from "@/lib/ledger";
import { cn, explorerUrl, formatNumber, shortenAddress, shortenHash } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { resolveWithdrawalUiStatus } from "@/lib/wallet/withdrawal-display";

type FilterKey = "ALL" | LedgerCategory;

const CATEGORY_ICON: Record<LedgerCategory, React.ElementType> = {
  DEPOSIT: ArrowDownToLine,
  WITHDRAWAL: ArrowUpFromLine,
  YIELD: Coins,
  COMMISSION: Users,
  TRADE: LineChart,
  ADJUSTMENT: Gift,
};

export default function HistoryPage() {
  const { t } = useI18n();
  const ledger = useLedger();
  const [filter, setFilter] = React.useState<FilterKey>("ALL");
  const [query, setQuery] = React.useState("");

  const counts = React.useMemo(() => {
    const c: Record<FilterKey, number> = {
      ALL: ledger.length,
      DEPOSIT: 0,
      WITHDRAWAL: 0,
      YIELD: 0,
      COMMISSION: 0,
      TRADE: 0,
      ADJUSTMENT: 0,
    };
    for (const e of ledger) c[e.category] += 1;
    return c;
  }, [ledger]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toUpperCase();
    return ledger.filter((e) => {
      if (filter !== "ALL" && e.category !== filter) return false;
      if (q) {
        const hay = [
          e.category,
          e.pair ?? "",
          e.txHash ?? "",
          e.sourceWallet ?? "",
          e.network ?? "",
          e.status ?? "",
          e.note ?? "",
        ]
          .join(" ")
          .toUpperCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ledger, filter, query]);

  function exportSubset(categories: LedgerCategory[], prefix: string) {
    const subset = ledger.filter((e) => categories.includes(e.category));
    if (subset.length === 0) return;
    downloadCsv(`valtrix-${prefix}-${Date.now()}.csv`, ledgerToCsv(subset));
  }

  function handleExport() {
    const csv = ledgerToCsv(filtered);
    downloadCsv(`valtrix-historial-${Date.now()}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.pages.history.title")}
        subtitle={t("historyPage.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => exportSubset(["YIELD"], "ganancias")}
              disabled={counts.YIELD === 0}
            >
              <Download className="h-3.5 w-3.5" />
              {t("historyPage.downloadEarnings")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => exportSubset(["WITHDRAWAL"], "retiros")}
              disabled={counts.WITHDRAWAL === 0}
            >
              <Download className="h-3.5 w-3.5" />
              {t("historyPage.downloadWithdrawals")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => exportSubset(["COMMISSION"], "red")}
              disabled={counts.COMMISSION === 0}
            >
              <Download className="h-3.5 w-3.5" />
              {t("historyPage.downloadNetwork")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => exportSubset(["TRADE"], "operativa")}
              disabled={counts.TRADE === 0}
            >
              <Download className="h-3.5 w-3.5" />
              {t("historyPage.downloadOperational")}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={handleExport}
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4" /> {t("dashboard.pages.history.exportCsv")}
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs filter={filter} counts={counts} onChange={setFilter} />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            placeholder={t("historyPage.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-border-subtle bg-bg-base pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none lg:w-72"
          />
        </div>
      </div>

      {ledger.length === 0 ? (
        <EmptyState />
      ) : (
        <LedgerTable rows={filtered} />
      )}
    </div>
  );
}

function FilterTabs({
  filter,
  counts,
  onChange,
}: {
  filter: FilterKey;
  counts: Record<FilterKey, number>;
  onChange: (f: FilterKey) => void;
}) {
  const { t } = useI18n();
  const items: { key: FilterKey; label: string }[] = [
    { key: "ALL", label: t("historyPage.filterAll") },
    { key: "DEPOSIT", label: t("historyPage.filterDeposits") },
    { key: "WITHDRAWAL", label: t("historyPage.filterWithdrawals") },
    { key: "YIELD", label: t("historyPage.filterYield") },
    { key: "COMMISSION", label: t("historyPage.filterCommissions") },
    { key: "ADJUSTMENT", label: t("historyPage.filterAdjustments") },
    { key: "TRADE", label: t("historyPage.filterTrades") },
  ];
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-md border border-border-subtle bg-bg-base/60 p-0.5">
      {items.map((it) => {
        const active = filter === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={cn(
              "rounded-sm px-3 py-1 text-xs transition-colors",
              active
                ? "bg-gold/15 text-gold"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
            )}
          >
            {it.label}
            <span className="ml-1.5 font-mono text-text-muted">
              {counts[it.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 p-12 text-center">
      <p className="text-sm text-text-secondary">{t("historyPage.empty")}</p>
      <div className="flex gap-2">
        <Button asChild variant="primary" size="md">
          <Link href="/dashboard/trade">{t("dashboard.pages.history.firstTrade")}</Link>
        </Button>
        <Button asChild variant="outline" size="md">
          <Link href="/dashboard/wallet">{t("historyPage.goWallet")}</Link>
        </Button>
      </div>
    </div>
  );
}

function LedgerTable({ rows }: { rows: LedgerEntry[] }) {
  const { t } = useI18n();
  return (
    <Table>
      <thead>
        <THeadRow>
          <TH>{t("historyPage.colDate")}</TH>
          <TH>{t("historyPage.colType")}</TH>
          <TH>{t("historyPage.colDetail")}</TH>
          <TH>{t("historyPage.colNetwork")}</TH>
          <TH className="text-right">{t("historyPage.colAmount")}</TH>
          <TH className="text-right">{t("historyPage.colRef")}</TH>
        </THeadRow>
      </thead>
      <TBody>
        {rows.map((e) => (
          <LedgerRow key={e.id} e={e} />
        ))}
      </TBody>
    </Table>
  );
}

function LedgerRow({ e }: { e: LedgerEntry }) {
  const { t } = useI18n();
  const Icon = CATEGORY_ICON[e.category];
  const positive = e.amount > 0;
  const negative = e.amount < 0;

  return (
    <TR>
      <TD className="text-text-secondary">
        <p className="font-mono text-xs">
          {new Date(e.timestamp).toLocaleString("es-ES", {
            hour12: false,
            timeZone: "UTC",
          })}{" "}
          {t("common.utc")}
        </p>
      </TD>
      <TD>
        <span className="inline-flex items-center gap-1.5 text-text-primary">
          <Icon className="h-3.5 w-3.5 text-gold" />
          {t(`walletPage.category.${e.category}`)}
        </span>
      </TD>
      <TD className="text-text-secondary">
        <LedgerDetail e={e} />
      </TD>
      <TD>
        {e.network ? (
          <Badge variant="outline">{e.network}</Badge>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </TD>
      <TD className="text-right">
        {e.category === "TRADE" ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span
            className={cn(
              "font-mono",
              positive && "text-success",
              negative && "text-danger",
            )}
          >
            {positive ? "+" : negative ? "−" : ""}$
            {formatNumber(Math.abs(e.amount), {
              decimals: e.category === "YIELD" || e.category === "COMMISSION" ? 4 : 2,
            })}
          </span>
        )}
      </TD>
      <TD className="text-right">
        {e.txHash ? (
          <a
            href={explorerUrl(e.network ?? "BSC", e.txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-gold hover:text-gold-bright"
          >
            {shortenHash(e.txHash)}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </TD>
    </TR>
  );
}

function LedgerDetail({ e }: { e: LedgerEntry }) {
  const { t } = useI18n();
  if (e.category === "TRADE") {
    const pair = PAIRS.find((p) => p.binance === e.pair);
    const up = e.direction === "UP";
    return (
      <span className="flex items-center gap-2">
        <span className="font-mono text-text-primary">
          {pair?.base ?? e.pair?.replace("USDT", "")}/USDT
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-xs",
            up ? "text-success" : "text-danger",
          )}
        >
          {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        </span>
        {e.status === "WIN" ? (
          <Badge variant="success">{t("common.win")}</Badge>
        ) : e.status === "LOSS" ? (
          <Badge variant="danger">{t("common.loss")}</Badge>
        ) : (
          <Badge variant="warning">{t("common.open")}</Badge>
        )}
      </span>
    );
  }
  if (e.category === "COMMISSION") {
    return (
      <span className="text-xs">
        <Badge variant="gold" className="mr-1.5">
          {t("referrals.level", { n: e.level ?? 0 })}
        </Badge>
        <span className="font-mono text-text-muted">
          {shortenAddress(e.sourceWallet ?? "")}
        </span>
      </span>
    );
  }
  if (e.category === "WITHDRAWAL") {
    const uiStatus = resolveWithdrawalUiStatus({
      status: e.status ?? "REQUESTED",
      txHash: e.txHash,
    });
    return (
      <span className="text-xs text-text-muted">
        {t("walletPage.status." + uiStatus)}
        {e.fee ? ` · ${t("historyPage.feeLabel")} $${formatNumber(e.fee, { decimals: 2 })}` : ""}
        {!e.txHash?.trim() && uiStatus !== "REJECTED"
          ? ` · ${t("historyPage.payoutPending")}`
          : ""}
      </span>
    );
  }
  if (e.category === "DEPOSIT") {
    return (
      <span className="text-xs text-text-muted">
        {t("walletPage.status." + (e.status ?? "ACTIVE"))}
      </span>
    );
  }
  if (e.category === "ADJUSTMENT") {
    return (
      <span className="text-xs text-text-muted">
        {e.note?.trim() || t("historyPage.adjustmentNoNote")}
      </span>
    );
  }
  return <span className="text-xs text-text-muted">{t("historyPage.dailyCredit")}</span>;
}
