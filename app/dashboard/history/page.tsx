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

type FilterKey = "ALL" | "WIN" | "LOSS" | "OPEN";

export default function HistoryPage() {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        subtitle="All trade activity across pairs and durations."
        actions={
          <Button variant="outline" size="md" disabled>
            <Download className="h-4 w-4" /> Export CSV
            <Badge variant="default" className="ml-2 text-[10px]">
              Week 5
            </Badge>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs filter={filter} counts={counts} onChange={setFilter} />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            placeholder="Filter by pair (e.g. BTC)…"
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
        title="Full transaction history"
        description="Deposits, withdrawals, commissions and yield credits will join this trade ledger with on-chain references and CSV export."
        features={[
          "On-chain tx hashes with BscScan / PolygonScan links",
          "Filter by event type / date / pair / network",
          "CSV export for accounting & taxes",
          "Pagination + saved views",
        ]}
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
  const items: { key: FilterKey; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "OPEN", label: "Open" },
    { key: "WIN", label: "Wins" },
    { key: "LOSS", label: "Losses" },
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
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 p-12 text-center">
      <p className="text-sm text-text-secondary">No trades yet.</p>
      <Button asChild variant="primary" size="md">
        <Link href="/dashboard/trade">Place your first trade</Link>
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
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Pair</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 font-medium">Entry</th>
              <th className="px-4 py-3 font-medium">Exit</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium text-right">Result</th>
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
                      {new Date(p.openedAt).toLocaleString("en-GB", {
                        hour12: false,
                        timeZone: "UTC",
                      })}{" "}
                      UTC
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
                      {p.direction === "UP" ? "BUY" : "SELL"}
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
                      <Badge variant="warning">OPEN</Badge>
                    ) : isWin ? (
                      <Badge variant="success">
                        <CircleCheck className="h-3 w-3" /> WIN · +0.10%
                      </Badge>
                    ) : (
                      <Badge variant="danger">
                        <CircleX className="h-3 w-3" /> LOSS
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
