"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { TablePagination } from "@/components/admin/table-pagination";
import { useI18n } from "@/lib/i18n/context";
import type { AdminMovement } from "@/lib/admin/store";
import { useTablePagination } from "@/lib/hooks/use-table-pagination";
import { cn, formatNumber, shortenAddress } from "@/lib/utils";

export function MovementTable({
  rows,
  emptyMessage,
  paginate = true,
  resetKey,
}: {
  rows: AdminMovement[];
  emptyMessage: string;
  paginate?: boolean;
  resetKey?: string | number;
}) {
  const { t } = useI18n();
  const pagination = useTablePagination(rows, {
    resetKey,
    pageSize: paginate ? 25 : rows.length || 25,
  });
  const displayRows = paginate ? pagination.paginatedItems : rows;

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border-subtle bg-bg-base/40 p-6 text-center text-sm text-text-secondary">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-0">
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
          {displayRows.map((m) => {
            const negative =
              m.type === "WITHDRAWAL" ||
              (m.type === "ADJUSTMENT" && m.amount < 0);
            const displayAmount = Math.abs(m.amount);
            return (
              <TR key={m.id}>
                <TD className="font-mono text-xs text-text-secondary">
                  {new Date(m.timestamp).toLocaleString("es-ES", {
                    timeZone: "UTC",
                    hour12: false,
                  })}
                </TD>
                <TD>
                  <div>
                    <p>{t(`walletPage.category.${m.type}`)}</p>
                    {m.type === "ADJUSTMENT" && m.note ? (
                      <p className="text-xs text-text-muted">{m.note}</p>
                    ) : null}
                  </div>
                </TD>
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
                    variant={
                      m.status === "COMPLETED" ||
                      m.status === "ACTIVE" ||
                      m.status === "CONFIRMED"
                        ? "success"
                        : "warning"
                    }
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
                  {negative ? "−" : "+"}$
                  {formatNumber(displayAmount, { decimals: 2 })}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      {paginate ? (
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
      ) : null}
    </div>
  );
}
