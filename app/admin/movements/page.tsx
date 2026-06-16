"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { DailyTransactionsPanel } from "@/components/admin/daily-transactions-panel";
import { MovementTable } from "@/components/admin/movement-table";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore, type AdminMovement } from "@/lib/admin/store";
import {
  filterMovementsByDay,
  utcDateKey,
} from "@/lib/admin/movements";
import { cn } from "@/lib/utils";

type FilterKey = "ALL" | AdminMovement["type"];
type ScopeKey = "today" | "all";

function AdminMovementsContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const movements = useAdminStore((s) => s.movements);
  const [filter, setFilter] = React.useState<FilterKey>("ALL");
  const [query, setQuery] = React.useState("");
  const [scope, setScope] = React.useState<ScopeKey>(
    searchParams.get("scope") === "all" ? "all" : "today",
  );
  const [dayKey, setDayKey] = React.useState(
    searchParams.get("date") ?? utcDateKey(),
  );

  const scopedMovements = React.useMemo(() => {
    if (scope === "today") {
      return filterMovementsByDay(movements, dayKey);
    }
    return [...movements].sort((a, b) => b.timestamp - a.timestamp);
  }, [movements, scope, dayKey]);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopedMovements.filter((m) => {
      if (filter !== "ALL" && m.type !== filter) return false;
      if (q && !m.wallet.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [scopedMovements, filter, query]);

  const filters: { key: FilterKey; label: string }[] = [
    { key: "ALL", label: t("admin.movements.filterAll") },
    { key: "DEPOSIT", label: t("walletPage.category.DEPOSIT") },
    { key: "WITHDRAWAL", label: t("walletPage.category.WITHDRAWAL") },
    { key: "YIELD", label: t("walletPage.category.YIELD") },
    { key: "COMMISSION", label: t("walletPage.category.COMMISSION") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.movements.title")}
        subtitle={t("admin.movements.subtitle")}
      />

      <DailyTransactionsPanel
        movements={movements}
        dayKey={dayKey}
        onDayKeyChange={(next) => {
          setDayKey(next);
          setScope("today");
        }}
        showDateControls
        showTable={false}
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-md border border-border-subtle bg-bg-base/60 p-0.5">
            <button
              type="button"
              onClick={() => setScope("today")}
              className={cn(
                "rounded-sm px-3 py-1 text-xs transition-colors",
                scope === "today"
                  ? "bg-gold/15 text-gold"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
              )}
            >
              {t("admin.movements.today")}
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={cn(
                "rounded-sm px-3 py-1 text-xs transition-colors",
                scope === "all"
                  ? "bg-gold/15 text-gold"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
              )}
            >
              {t("admin.movements.allDays")}
            </button>
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-sm px-3 py-1 text-xs transition-colors",
                  filter === f.key
                    ? "bg-gold/15 text-gold"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("admin.movements.searchPlaceholder")}
              className="w-full pl-8 lg:w-72"
            />
          </div>
        </div>

        <MovementTable
          rows={rows}
          emptyMessage={t("admin.movements.dailyEmpty")}
        />
      </div>
    </div>
  );
}

export default function AdminMovementsPage() {
  return (
    <Suspense fallback={null}>
      <AdminMovementsContent />
    </Suspense>
  );
}
