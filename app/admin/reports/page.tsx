"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore } from "@/lib/admin/store";
import {
  exportAuditCsv,
  exportMovementsCsv,
  exportUsersCsv,
} from "@/lib/admin/exports";
import { ledgerToCsv, downloadCsv, useLedger } from "@/lib/ledger";

export default function AdminReportsPage() {
  const { t } = useI18n();
  const users = useAdminStore((s) => s.users);
  const movements = useAdminStore((s) => s.movements);
  const audit = useAdminStore((s) => s.audit);
  const ledger = useLedger();

  const reports = [
    {
      title: t("admin.reports.users"),
      desc: t("admin.reports.usersDesc"),
      action: () => exportUsersCsv(users),
    },
    {
      title: t("admin.reports.movements"),
      desc: t("admin.reports.movementsDesc"),
      action: () => exportMovementsCsv(movements),
    },
    {
      title: t("admin.reports.audit"),
      desc: t("admin.reports.auditDesc"),
      action: () => exportAuditCsv(audit),
    },
    {
      title: t("admin.reports.myLedger"),
      desc: t("admin.reports.myLedgerDesc"),
      action: () =>
        downloadCsv(
          `valtrix-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
          ledgerToCsv(ledger),
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.reports.title")}
        subtitle={t("admin.reports.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((r) => (
          <Card key={r.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4 text-gold" />
                {r.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-sm text-text-secondary">{r.desc}</p>
              <Button variant="outline" size="sm" onClick={r.action}>
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
