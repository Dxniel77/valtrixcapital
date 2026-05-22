"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { PAIRS } from "@/lib/market/pairs";
import { useTradeStore, utcDayKey, type TradeStatus } from "@/lib/trade/store";
import { cn, formatNumber } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  CircleX,
  Download,
  Search,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/context";

type FilterKey = "ALL" | "WIN" | "LOSS" | "OPEN";

export default function HistoryPage() {
  const { t } = useI18n();
  const positions = useTradeStore((s) => s.positions);
  const [filter, setFilter] = React.useState<FilterKey>("ALL");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toUpperCase();
    return positions.filter((p) => {
      if (filter !== "ALL" && p.status !== filter) return false;
      if (q && !p.pair.includes(q)) return false;
      return true;
    });
  }, [positions, filter, query]);

  const counts = React.useMemo(() => {
    const c = { ALL: positions.length, WIN: 0, LOSS: 0, OPEN: 0 };
    for (const p of positions) {
      if (p.status === "WIN") c.WIN++;
      else if (p.status === "LOSS") c.LOSS++;
      else c.OPEN++;
    }
    return c;
  }, [positions]);

  const comingFeatures = [0, 1, 2, 3].map((i) =>
    t(`dashboard.pages.history.comingFeatures.${i}`),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.pages.history.title")}
        subtitle={t("dashboard.pages.history.subtitle")}
        actions={
          <Button variant="outline" size="md" disabled>
            <Download className="h-4 w-4" /> {t("dashboard.pages.history.exportCsv")}
            <Badge variant="default" className="ml-2 text-[10px]">
              Semana 5
            </Badge>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs filter={filter} counts={counts} onChange={setFilter} />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            placeholder={t("dashboard.pages.history.filterPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-border-subtle bg-bg-base pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none sm:w-72"
          />
        </div>
      </div>

      {positions.length === 0 ? (
        <EmptyState />
      ) : (
        <TradesTable rows={filtered} />
      )}

      <ComingSoon
        week={5}
        title={t("dashboard.pages.history.comingTitle")}
        description={t("dashboard.pages.history.comingDesc")}
        features={comingFeatures}
      />
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
    { key: "ALL", label: t("dashboard.pages.history.filterAll") },
    { key: "OPEN", label: t("dashboard.pages.history.filterOpen") },
    { key: "WIN", label: t("dashboard.pages.history.filterWins") },
    { key: "LOSS", label: t("dashboard.pages.history.filterLosses") },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-base/60 p-0.5">
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
      <p className="text-sm text-text-secondary">{t("dashboard.pages.history.empty")}</p>
      <Button asChild variant="primary" size="md">
        <Link href="/dashboard/trade">{t("dashboard.pages.history.firstTrade")}</Link>
      </Button>
    </div>
  );
}

function TradesTable({
  rows,
}: {
  rows: {
    id: string;
    pair: string;
    direction: "UP" | "DOWN";
    entryPrice: number;
    exitPrice?: number;
    durationSec: number;
    openedAt: number;
    resolvedAt?: number;
    status: TradeStatus;
  }[];
}) {
  const { t } = useI18n();

  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3 font-medium">{t("dashboard.pages.history.colDate")}</th>
              <th className="px-4 py-3 font-medium">{t("dashboard.pages.history.colPair")}</th>
              <th className="px-4 py-3 font-medium">{t("dashboard.pages.history.colSide")}</th>
              <th className="px-4 py-3 font-medium">{t("dashboard.pages.history.colEntry")}</th>
              <th className="px-4 py-3 font-medium">{t("dashboard.pages.history.colExit")}</th>
              <th className="px-4 py-3 font-medium">{t("dashboard.pages.history.colDuration")}</th>
              <th className="px-4 py-3 font-medium text-right">
                {t("dashboard.pages.history.colResult")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((p) => {
              const pair = PAIRS.find((x) => x.binance === p.pair);
              const isWin = p.status === "WIN";
              const isOpen = p.status === "OPEN";
              return (
                <tr key={p.id} className="hover:bg-bg-hover/40">
                  <td className="px-4 py-3 text-text-secondary">
                    <p className="font-mono">
                      {new Date(p.openedAt).toLocaleString("es-ES", {
                        hour12: false,
                        timeZone: "UTC",
                      })}{" "}
                      {t("common.utc")}
                    </p>
                    <p className="text-xs text-text-muted">
                      {utcDayKey(p.openedAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-text-primary">
                      {pair?.base ?? p.pair.replace("USDT", "")}/USDT
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs",
                        p.direction === "UP"
                          ? "bg-success/10 text-success"
                          : "bg-danger/10 text-danger",
                      )}
                    >
                      {p.direction === "UP" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {p.direction === "UP" ? t("common.buy") : t("common.sell")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-text-secondary">
                    {formatNumber(p.entryPrice, {
                      decimals: pair?.pricePrecision ?? 2,
                    })}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-secondary">
                    {p.exitPrice
                      ? formatNumber(p.exitPrice, {
                          decimals: pair?.pricePrecision ?? 2,
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-muted">
                    {p.durationSec / 60}m
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isOpen ? (
                      <Badge variant="warning">{t("common.open")}</Badge>
                    ) : isWin ? (
                      <Badge variant="success">
                        <CircleCheck className="h-3 w-3" />{" "}
                        {t("dashboard.pages.history.winBonus")}
                      </Badge>
                    ) : (
                      <Badge variant="danger">
                        <CircleX className="h-3 w-3" /> {t("common.loss")}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
