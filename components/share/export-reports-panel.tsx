"use client";

import * as React from "react";
import {
  Activity,
  ArrowDownToLine,
  Download,
  FileSpreadsheet,
  Network,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

interface ExportItem {
  id: string;
  title: string;
  action: () => void;
}

interface ExportReportsPanelProps {
  items: ExportItem[];
}

const EXPORT_META: Record<
  string,
  { icon: React.ElementType; accent: string; hintKey: string }
> = {
  earnings: {
    icon: FileSpreadsheet,
    accent: "from-gold/40 to-transparent",
    hintKey: "share.exportEarningsHint",
  },
  withdrawals: {
    icon: ArrowDownToLine,
    accent: "from-info/40 to-transparent",
    hintKey: "share.exportWithdrawalsHint",
  },
  network: {
    icon: Network,
    accent: "from-success/40 to-transparent",
    hintKey: "share.exportNetworkHint",
  },
  operational: {
    icon: Activity,
    accent: "from-silver/40 to-transparent",
    hintKey: "share.exportOperationalHint",
  },
};

export function ExportReportsPanel({ items }: ExportReportsPanelProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("share.reportsTitle")}</CardTitle>
        <p className="text-sm text-text-secondary">{t("share.exportsSubtitle")}</p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const meta = EXPORT_META[item.id];
          const Icon = meta?.icon ?? FileSpreadsheet;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className={cn(
                "group relative overflow-hidden rounded-lg border border-border-subtle bg-bg-base/40 p-4 text-left transition-colors",
                "hover:border-border-strong hover:bg-bg-hover",
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r",
                  meta?.accent ?? "from-transparent",
                )}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md border border-border-subtle bg-bg-elevated p-1.5 text-text-secondary">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-sm font-medium text-text-primary">
                      {item.title}
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-text-muted">
                    {t(meta?.hintKey ?? "share.exportCsv")}
                  </p>
                </div>
                <Download className="h-4 w-4 shrink-0 text-text-muted transition-colors group-hover:text-gold" />
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
