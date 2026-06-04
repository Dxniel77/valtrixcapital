"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore, type AdminMovement } from "@/lib/admin/store";
import { cn, formatNumber, shortenAddress } from "@/lib/utils";

type FilterKey = "ALL" | AdminMovement["type"];

export default function AdminMovementsPage() {
  const { t } = useI18n();
  const movements = useAdminStore((s) => s.movements);
  const [filter, setFilter] = React.useState<FilterKey>("ALL");
  const [query, setQuery] = React.useState("");

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements.filter((m) => {
      if (filter !== "ALL" && m.type !== filter) return false;
      if (q && !m.wallet.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [movements, filter, query]);

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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-md border border-border-subtle bg-bg-base/60 p-0.5">
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

      <Table>
        <thead>
          <THeadRow>
            <TH>{t("admin.movements.colDate")}</TH>
            <TH>{t("admin.movements.colType")}</TH>
            <TH>{t("admin.movements.colWallet")}</TH>
            <TH>{t("admin.movements.colNetwork")}</TH>
            <TH>{t("admin.movements.colStatus")}</TH>
            <TH className="text-right">{t("admin.movements.colAmount")}</TH>
          </THeadRow>
        </thead>
        <TBody>
          {rows.map((m) => {
            const negative = m.type === "WITHDRAWAL";
            return (
              <TR key={m.id}>
                <TD className="font-mono text-xs text-text-secondary">
                  {new Date(m.timestamp).toLocaleString("es-ES", {
                    timeZone: "UTC",
                    hour12: false,
                  })}
                </TD>
                <TD>{t(`walletPage.category.${m.type}`)}</TD>
                <TD className="font-mono text-text-secondary">
                  {shortenAddress(m.wallet)}
                </TD>
                <TD>
                  {m.network ? (
                    <Badge variant="outline">{m.network}</Badge>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </TD>
                <TD>
                  <Badge
                    variant={m.status === "COMPLETED" ? "success" : "warning"}
                  >
                    {t(`walletPage.status.${m.status}`)}
                  </Badge>
                </TD>
                <TD
                  className={cn(
                    "text-right font-mono",
                    negative ? "text-danger" : "text-success",
                  )}
                >
                  {negative ? "−" : "+"}${formatNumber(m.amount, { decimals: 2 })}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
