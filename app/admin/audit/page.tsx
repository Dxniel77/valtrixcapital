"use client";

import * as React from "react";
import { ClipboardList } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/context";
import { useAdminAuditSync } from "@/lib/hooks/use-admin-audit-sync";
import { useAdminStore } from "@/lib/admin/store";
import {
  auditDetailMissingOnChainTx,
  localizeAuditDetail,
} from "@/lib/admin/audit-format";

const ACTION_VARIANT: Record<string, "success" | "danger" | "info" | "gold" | "warning"> = {
  USER_ACTIVATED: "success",
  USER_DEACTIVATED: "danger",
  BALANCE_ADJUSTED: "gold",
  SETTINGS_UPDATED: "info",
  WITHDRAWAL_AUTO_PAID: "success",
  WITHDRAWAL_APPROVED: "info",
  WITHDRAWAL_REJECTED: "danger",
};

export default function AdminAuditPage() {
  const { t } = useI18n();
  useAdminAuditSync();
  const audit = useAdminStore((s) => s.audit);

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
            {audit.map((a) => (
              <TR key={a.id}>
                <TD className="font-mono text-xs text-text-secondary">
                  {new Date(a.timestamp).toLocaleString("es-ES", {
                    timeZone: "UTC",
                    hour12: false,
                  })}
                </TD>
                <TD>
                  <Badge variant={ACTION_VARIANT[a.action] ?? "default"}>
                    {t(`admin.actions.${a.action}`)}
                  </Badge>
                </TD>
                <TD className="text-text-primary">{a.target}</TD>
                <TD
                  className={
                    auditDetailMissingOnChainTx(a.detail)
                      ? "font-medium text-amber-600 dark:text-amber-400"
                      : "text-text-secondary"
                  }
                >
                  {localizeAuditDetail(a.detail, t)}
                </TD>
                <TD className="font-mono text-xs text-text-muted">{a.actor}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
