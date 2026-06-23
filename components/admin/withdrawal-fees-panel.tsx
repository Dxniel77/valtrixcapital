"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber, shortenAddress } from "@/lib/utils";
import type { WithdrawalFeeRowDto } from "@/lib/services/admin-reports";

export function WithdrawalFeesPanel({
  fees,
  totalFees,
  withdrawalCount,
}: {
  fees: WithdrawalFeeRowDto[];
  totalFees: number;
  withdrawalCount: number;
}) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.withdrawalFees.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">
          {t("admin.withdrawalFees.subtitle")}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border-subtle p-4">
            <p className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.withdrawalFees.totalFees")}
            </p>
            <p className="mt-1 font-mono text-xl text-gold">
              ${formatNumber(totalFees, { decimals: 2 })}
            </p>
          </div>
          <div className="rounded-lg border border-border-subtle p-4">
            <p className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.withdrawalFees.withdrawalCount")}
            </p>
            <p className="mt-1 font-mono text-xl text-text-primary">
              {withdrawalCount}
            </p>
          </div>
        </div>

        {fees.length === 0 ? (
          <p className="text-sm text-text-muted">{t("admin.withdrawalFees.empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border-subtle bg-bg-base/60 text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-3 py-2">{t("admin.withdrawalFees.colDate")}</th>
                  <th className="px-3 py-2">{t("admin.withdrawalFees.colWallet")}</th>
                  <th className="px-3 py-2">{t("admin.withdrawalFees.colNetwork")}</th>
                  <th className="px-3 py-2 text-right">{t("admin.withdrawalFees.colGross")}</th>
                  <th className="px-3 py-2 text-right">{t("admin.withdrawalFees.colFee")}</th>
                  <th className="px-3 py-2 text-right">{t("admin.withdrawalFees.colNet")}</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border-subtle/60 last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                      {new Date(row.processedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {shortenAddress(row.wallet)}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{row.network}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      ${formatNumber(row.gross, { decimals: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gold">
                      ${formatNumber(row.fee, { decimals: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-success">
                      ${formatNumber(row.net, { decimals: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
