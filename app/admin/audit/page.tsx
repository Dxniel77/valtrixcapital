"use client";

import * as React from "react";
import { ClipboardList, Search } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { CopyableText } from "@/components/ui/copyable-text";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/context";
import { useAdminAuditSync } from "@/lib/hooks/use-admin-audit-sync";
import { useAdminStore } from "@/lib/admin/store";
import {
  auditActionSeverity,
  auditActionVariant,
  uniqueAuditActions,
  uniqueAuditAdmins,
  type AuditSeverity,
} from "@/lib/admin/audit-filters";
import {
  auditDetailMissingOnChainTx,
  localizeAuditDetail,
} from "@/lib/admin/audit-format";
import { TablePagination } from "@/components/admin/table-pagination";
import { useTablePagination } from "@/lib/hooks/use-table-pagination";
import { cn, shortenAddress } from "@/lib/utils";

const SEVERITY_FILTERS: Array<{
  key: "all" | AuditSeverity;
  labelKey:
    | "filterAll"
    | "severityCritical"
    | "severityMoney"
    | "severityWarning"
    | "severityRoutine";
  activeClass: string;
}> = [
  { key: "all", labelKey: "filterAll", activeClass: "bg-gold/15 text-gold" },
  {
    key: "critical",
    labelKey: "severityCritical",
    activeClass: "bg-danger/15 text-danger",
  },
  {
    key: "money",
    labelKey: "severityMoney",
    activeClass: "bg-gold/15 text-gold",
  },
  {
    key: "warning",
    labelKey: "severityWarning",
    activeClass: "bg-warning/15 text-warning",
  },
  {
    key: "routine",
    labelKey: "severityRoutine",
    activeClass: "bg-info/15 text-info",
  },
];

export default function AdminAuditPage() {
  const { t } = useI18n();
  useAdminAuditSync();
  const audit = useAdminStore((s) => s.audit);
  const users = useAdminStore((s) => s.users);

  const [query, setQuery] = React.useState("");
  const [severity, setSeverity] = React.useState<"all" | AuditSeverity>("all");
  const [adminWallet, setAdminWallet] = React.useState("all");
  const [actionType, setActionType] = React.useState("all");

  const knownAdmins = React.useMemo(
    () =>
      users
        .filter((user) => user.role === "ADMIN")
        .map((user) => ({
          wallet: user.wallet.toLowerCase(),
          label: user.alias?.trim() || shortenAddress(user.wallet),
        })),
    [users],
  );

  const admins = React.useMemo(
    () => uniqueAuditAdmins(audit, knownAdmins),
    [audit, knownAdmins],
  );

  const actionTypes = React.useMemo(() => uniqueAuditActions(audit), [audit]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return audit.filter((row) => {
      if (severity !== "all" && auditActionSeverity(row.action) !== severity) {
        return false;
      }
      if (actionType !== "all" && row.action !== actionType) return false;
      if (adminWallet !== "all") {
        const actor = (row.actorWallet ?? "").toLowerCase();
        if (actor !== adminWallet) return false;
      }
      if (q) {
        const hay = [
          row.action,
          row.target,
          row.targetWallet ?? "",
          row.actor,
          row.actorWallet ?? "",
          row.detail,
          row.txHash ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [audit, query, severity, adminWallet, actionType]);

  const pagination = useTablePagination(filtered, {
    resetKey: `${query}|${severity}|${adminWallet}|${actionType}`,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.audit.title")}
        subtitle={t("admin.audit.subtitle")}
      />

      {audit.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center gap-2 p-12 text-center">
          <ClipboardList className="h-8 w-8 text-text-muted" />
          <p className="text-sm text-text-secondary">{t("admin.audit.empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("admin.audit.searchPlaceholder")}
                className="pl-8"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-text-muted">
                {t("admin.audit.filterSeverity")}
              </span>
              <div className="inline-flex flex-wrap rounded-md border border-border-subtle bg-bg-base/60 p-0.5">
                {SEVERITY_FILTERS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSeverity(item.key)}
                    className={cn(
                      "rounded-sm px-3 py-1.5 text-xs transition-colors",
                      severity === item.key
                        ? item.activeClass
                        : "text-text-secondary hover:bg-bg-hover",
                    )}
                  >
                    {t(`admin.audit.${item.labelKey}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-text-muted">
                {t("admin.audit.filterAdmin")}
              </span>
              <div className="inline-flex flex-wrap rounded-md border border-border-subtle bg-bg-base/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setAdminWallet("all")}
                  className={cn(
                    "rounded-sm px-3 py-1.5 text-xs transition-colors",
                    adminWallet === "all"
                      ? "bg-gold/15 text-gold"
                      : "text-text-secondary hover:bg-bg-hover",
                  )}
                >
                  {t("admin.audit.filterAll")}
                </button>
                {admins.map((admin) => (
                  <button
                    key={admin.wallet}
                    type="button"
                    onClick={() => setAdminWallet(admin.wallet)}
                    className={cn(
                      "rounded-sm px-3 py-1.5 text-xs transition-colors",
                      adminWallet === admin.wallet
                        ? "bg-gold/15 text-gold"
                        : "text-text-secondary hover:bg-bg-hover",
                    )}
                  >
                    {admin.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-text-muted">
                {t("admin.audit.filterAction")}
              </span>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="rounded-md border border-border-subtle bg-bg-base px-3 py-1.5 text-xs text-text-primary"
              >
                <option value="all">{t("admin.audit.actionAll")}</option>
                {actionTypes.map((action) => (
                  <option key={action} value={action}>
                    {t(`admin.actions.${action}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-subtle bg-bg-base/40 p-6 text-center text-sm text-text-secondary">
              {t("admin.audit.noMatches")}
            </p>
          ) : (
            <div className="space-y-0">
              <Table>
                <thead>
                  <THeadRow>
                    <TH>{t("admin.audit.colTime")}</TH>
                    <TH>{t("admin.audit.colAction")}</TH>
                    <TH>{t("admin.audit.colTarget")}</TH>
                    <TH>{t("admin.audit.colDetail")}</TH>
                    <TH>{t("admin.audit.colActor")}</TH>
                  </THeadRow>
                </thead>
                <TBody>
                  {pagination.paginatedItems.map((a) => (
                    <TR key={a.id}>
                      <TD className="whitespace-nowrap font-mono text-xs text-text-secondary">
                        {new Date(a.timestamp).toLocaleString("es-ES", {
                          timeZone: "UTC",
                          hour12: false,
                        })}
                      </TD>
                      <TD>
                        <Badge variant={auditActionVariant(a.action)}>
                          {t(`admin.actions.${a.action}`)}
                        </Badge>
                      </TD>
                      <TD>
                        {a.targetWallet ? (
                          <div className="min-w-0">
                            {a.target !== a.targetWallet &&
                            !a.target.startsWith("0x") ? (
                              <p className="truncate text-sm text-text-primary">
                                {a.target}
                              </p>
                            ) : null}
                            <CopyableText value={a.targetWallet} kind="address" />
                          </div>
                        ) : (
                          <span className="text-text-muted">{a.target || "—"}</span>
                        )}
                      </TD>
                      <TD
                        className={
                          auditDetailMissingOnChainTx(a.detail)
                            ? "font-medium text-amber-600 dark:text-amber-400"
                            : "text-text-secondary"
                        }
                      >
                        <p className="text-sm leading-snug">
                          {localizeAuditDetail(a.detail, t)}
                        </p>
                        {a.txHash ? (
                          <CopyableText
                            value={a.txHash}
                            kind="tx"
                            className="mt-0.5"
                          />
                        ) : null}
                      </TD>
                      <TD>
                        {a.actorWallet ? (
                          <div className="min-w-0">
                            {a.actor !== a.actorWallet &&
                            !a.actor.startsWith("0x") ? (
                              <p className="truncate text-sm text-text-primary">
                                {a.actor}
                              </p>
                            ) : null}
                            <CopyableText value={a.actorWallet} kind="address" />
                          </div>
                        ) : (
                          <CopyableText value={a.actor} kind="address" />
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <TablePagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                rangeStart={pagination.rangeStart}
                rangeEnd={pagination.rangeEnd}
                pageSize={pagination.pageSize}
                pageSizeOptions={pagination.pageSizeOptions}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
