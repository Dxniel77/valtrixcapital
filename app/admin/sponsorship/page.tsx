"use client";

import * as React from "react";
import { toast } from "sonner";
import { Calendar, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";
import { formatNumber, shortenAddress } from "@/lib/utils";
import { TablePagination } from "@/components/admin/table-pagination";
import { useTablePagination } from "@/lib/hooks/use-table-pagination";

interface DurationRule {
  id: string;
  minAmount: number;
  durationDays: number;
  label: string | null;
  isActive: boolean;
}

interface SponsorshipPeriod {
  id: string;
  walletAddress?: string;
  username?: string | null;
  amount: number;
  startDate: string;
  endDate: string;
  status: string;
  remainingDays: number;
}

export default function AdminSponsorshipPage() {
  const { t } = useI18n();
  const [rules, setRules] = React.useState<DurationRule[]>([]);
  const [periods, setPeriods] = React.useState<SponsorshipPeriod[]>([]);
  const [minAmount, setMinAmount] = React.useState("100");
  const [durationDays, setDurationDays] = React.useState("30");
  const [label, setLabel] = React.useState("$100 = 30 days");
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    const [rulesRes, periodsRes] = await Promise.all([
      apiFetch<{ rules: DurationRule[] }>("/api/admin/sponsorship/rules"),
      apiFetch<{ periods: SponsorshipPeriod[] }>("/api/admin/sponsorship/periods"),
    ]);
    setRules(rulesRes.rules);
    setPeriods(periodsRes.periods);
  }, []);

  React.useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  const pagination = useTablePagination(periods);

  async function addRule() {
    setLoading(true);
    try {
      await apiFetch("/api/admin/sponsorship/rules", {
        method: "POST",
        body: JSON.stringify({
          minAmount: Number(minAmount),
          durationDays: Number(durationDays),
          label: label.trim() || undefined,
        }),
      });
      toast.success(t("admin.sponsorship.ruleSaved"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function toggleRule(rule: DurationRule) {
    await apiFetch(`/api/admin/sponsorship/rules/${rule.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.sponsorship.title")}
        subtitle={t("admin.sponsorship.subtitle")}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              {t("admin.sponsorship.rulesTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-text-secondary">{t("admin.sponsorship.rulesHint")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="Min amount (USD)"
              />
              <Input
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="Days"
              />
            </div>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("admin.sponsorship.labelPlaceholder")}
            />
            <Button variant="primary" size="sm" onClick={() => void addRule()} loading={loading}>
              {t("admin.sponsorship.addRule")}
            </Button>

            <ul className="space-y-2 border-t border-border-subtle pt-4">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className="flex items-center justify-between rounded-md border border-border-subtle px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      ${formatNumber(rule.minAmount, { decimals: 0 })} → {rule.durationDays}{" "}
                      {t("admin.sponsorship.days")}
                    </p>
                    {rule.label ? (
                      <p className="text-xs text-text-muted">{rule.label}</p>
                    ) : null}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => void toggleRule(rule)}>
                    <Badge variant={rule.isActive ? "success" : "outline"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              {t("admin.sponsorship.calendarTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead>
                <THeadRow>
                  <TH>{t("admin.sponsorship.user")}</TH>
                  <TH>{t("admin.sponsorship.amount")}</TH>
                  <TH>{t("admin.sponsorship.ends")}</TH>
                  <TH>{t("admin.sponsorship.remaining")}</TH>
                  <TH>{t("admin.sponsorship.status")}</TH>
                </THeadRow>
              </thead>
              <TBody>
                {periods.length === 0 ? (
                  <TR>
                    <TD colSpan={5} className="text-center text-text-muted">
                      {t("admin.sponsorship.empty")}
                    </TD>
                  </TR>
                ) : (
                  pagination.paginatedItems.map((p) => (
                    <TR key={p.id}>
                      <TD>
                        <div>
                          <p className="text-sm">{p.username ?? "—"}</p>
                          <p className="font-mono text-[10px] text-text-muted">
                            {p.walletAddress ? shortenAddress(p.walletAddress) : "—"}
                          </p>
                        </div>
                      </TD>
                      <TD>${formatNumber(p.amount, { decimals: 0 })}</TD>
                      <TD>{new Date(p.endDate).toLocaleDateString()}</TD>
                      <TD>{p.remainingDays}d</TD>
                      <TD>
                        <Badge variant={p.status === "EXPIRED" ? "danger" : p.status === "EXPIRING_SOON" ? "warning" : "success"}>
                          {p.status}
                        </Badge>
                      </TD>
                    </TR>
                  ))
                )}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
