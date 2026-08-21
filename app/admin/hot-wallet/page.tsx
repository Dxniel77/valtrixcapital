"use client";

import * as React from "react";
import { ArrowUpFromLine, ExternalLink, RefreshCw, Search } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyableText } from "@/components/ui/copyable-text";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { TablePagination } from "@/components/admin/table-pagination";
import { useTablePagination } from "@/lib/hooks/use-table-pagination";
import { useI18n } from "@/lib/i18n/context";
import {
  fetchAdminHotWalletOutflows,
  type HotWalletOutflowDto,
  type HotWalletOutflowMatch,
} from "@/lib/api/client";
import { cn, formatNumber } from "@/lib/utils";

type MatchFilter = "all" | "unregistered" | "matched";

function matchBadge(
  match: HotWalletOutflowMatch,
  t: (key: string) => string,
): { label: string; variant: "danger" | "success" | "info" } {
  if (match === "unregistered") {
    return { label: t("admin.hotWallet.matchUnregistered"), variant: "danger" };
  }
  if (match === "user_payout") {
    return { label: t("admin.hotWallet.matchUserPayout"), variant: "success" };
  }
  return { label: t("admin.hotWallet.matchTreasury"), variant: "info" };
}

export default function AdminHotWalletPage() {
  const { t } = useI18n();
  const [items, setItems] = React.useState<HotWalletOutflowDto[]>([]);
  const [wallets, setWallets] = React.useState<string[]>([]);
  const [usdtContract, setUsdtContract] = React.useState("");
  const [explorerConfigured, setExplorerConfigured] = React.useState(true);
  const [minUsd, setMinUsd] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [matchFilter, setMatchFilter] = React.useState<MatchFilter>("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await fetchAdminHotWalletOutflows();
      setItems(result.items);
      setWallets(result.wallets);
      setUsdtContract(result.usdtContract);
      setExplorerConfigured(result.explorerConfigured);
      setMinUsd(result.minUsd);
    } catch {
      setError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const unregistered = React.useMemo(
    () => items.filter((item) => item.match === "unregistered"),
    [items],
  );
  const unregisteredSum = unregistered.reduce((sum, item) => sum + item.amount, 0);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (matchFilter === "unregistered" && item.match !== "unregistered") return false;
      if (matchFilter === "matched" && item.match === "unregistered") return false;
      if (!q) return true;
      return (
        item.toAddress.includes(q) ||
        item.txHash.includes(q) ||
        (item.toLabel?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, matchFilter, query]);

  const paging = useTablePagination(filtered, {
    resetKey: `${query}|${matchFilter}|${items.length}`,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.hotWallet.title")}
        subtitle={t("admin.hotWallet.subtitle")}
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            {t("admin.hotWallet.refresh")}
          </Button>
        }
      />

      <p className="text-sm text-text-secondary">{t("admin.hotWallet.explain")}</p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t("admin.hotWallet.scanned")}
          value={loading ? "…" : formatNumber(items.length, { decimals: 0 })}
          hint={t("admin.hotWallet.scannedHint", { min: minUsd })}
          icon={ArrowUpFromLine}
        />
        <StatTile
          label={t("admin.hotWallet.unregisteredCount")}
          value={loading ? "…" : formatNumber(unregistered.length, { decimals: 0 })}
          hint={t("admin.hotWallet.unregisteredHint")}
          accent={unregistered.length > 0 ? "danger" : "success"}
        />
        <StatTile
          label={t("admin.hotWallet.unregisteredSum")}
          value={loading ? "…" : `$${formatNumber(unregisteredSum)}`}
          hint="USDT"
          accent={unregisteredSum > 0 ? "danger" : "default"}
        />
        <StatTile
          label={t("admin.hotWallet.network")}
          value="BSC"
          hint={t("admin.hotWallet.officialUsdt")}
        />
      </div>

      <div className="rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3 text-xs text-text-secondary">
        <p>
          {t("admin.hotWallet.walletsLabel")}{" "}
          {wallets.length === 0
            ? t("admin.hotWallet.walletMissing")
            : wallets.map((wallet) => (
                <CopyableText key={wallet} value={wallet} kind="address" />
              ))}
        </p>
        {usdtContract ? (
          <p className="mt-1">
            {t("admin.hotWallet.contractLabel")}{" "}
            <CopyableText value={usdtContract} kind="address" />
          </p>
        ) : null}
      </div>

      {!explorerConfigured && !loading ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
          {t("admin.hotWallet.noExplorer")}
        </div>
      ) : null}
      {explorerConfigured && wallets.length === 0 && !loading ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
          {t("admin.hotWallet.noWallet")}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {t("admin.hotWallet.loadError")}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("admin.hotWallet.search")}
            className="pl-9"
          />
        </div>
        {(
          [
            ["all", "admin.hotWallet.filterAll"],
            ["unregistered", "admin.hotWallet.filterUnregistered"],
            ["matched", "admin.hotWallet.filterMatched"],
          ] as const
        ).map(([key, labelKey]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMatchFilter(key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              matchFilter === key
                ? key === "unregistered"
                  ? "bg-danger/15 text-danger"
                  : "bg-gold/15 text-gold"
                : "text-text-secondary hover:bg-bg-hover",
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <Table>
        <thead>
          <THeadRow>
            <TH>{t("admin.hotWallet.colDate")}</TH>
            <TH className="text-right">{t("admin.hotWallet.colAmount")}</TH>
            <TH>{t("admin.hotWallet.colDestination")}</TH>
            <TH>{t("admin.hotWallet.colMatch")}</TH>
            <TH>{t("admin.hotWallet.colTx")}</TH>
          </THeadRow>
        </thead>
        <TBody>
            {loading ? (
              <TR>
                <TD colSpan={5} className="py-10 text-center text-text-secondary">
                  {t("admin.hotWallet.loading")}
                </TD>
              </TR>
            ) : paging.paginatedItems.length === 0 ? (
              <TR>
                <TD colSpan={5} className="py-10 text-center text-text-secondary">
                  {t("admin.hotWallet.empty")}
                </TD>
              </TR>
            ) : (
              paging.paginatedItems.map((item) => {
                const badge = matchBadge(item.match, t);
                return (
                  <TR key={item.id}>
                    <TD className="whitespace-nowrap text-text-secondary">
                      {new Date(item.timestamp).toLocaleString("es-ES", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TD>
                    <TD className="text-right font-medium tabular-nums">
                      {formatNumber(item.amount)} USDT
                    </TD>
                    <TD>
                      <div className="flex flex-col">
                        {item.toLabel ? (
                          <span className="text-sm text-text-primary">{item.toLabel}</span>
                        ) : null}
                        <CopyableText value={item.toAddress} kind="address" />
                      </div>
                    </TD>
                    <TD>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        <CopyableText value={item.txHash} kind="tx" />
                        <a
                          href={item.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                          title="BscScan"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </TD>
                  </TR>
                );
              })
            )}
        </TBody>
      </Table>

      {!loading && filtered.length > 0 ? (
        <TablePagination
          page={paging.page}
          totalPages={paging.totalPages}
          totalItems={paging.totalItems}
          rangeStart={paging.rangeStart}
          rangeEnd={paging.rangeEnd}
          pageSize={paging.pageSize}
          pageSizeOptions={paging.pageSizeOptions}
          onPageChange={paging.setPage}
          onPageSizeChange={paging.setPageSize}
        />
      ) : null}
    </div>
  );
}
