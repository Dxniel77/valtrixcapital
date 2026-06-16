"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/context";
import type { AdminMovement } from "@/lib/admin/store";
import { cn, formatNumber, shortenAddress } from "@/lib/utils";

export function MovementTable({
  rows,
  emptyMessage,
}: {
  rows: AdminMovement[];
  emptyMessage: string;
}) {
  const { t } = useI18n();

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border-subtle bg-bg-base/40 p-6 text-center text-sm text-text-secondary">
        {emptyMessage}
      </p>
    );
  }

  return (
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
                  variant={
                    m.status === "COMPLETED" || m.status === "ACTIVE"
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
                {negative ? "−" : "+"}${formatNumber(m.amount, { decimals: 2 })}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
