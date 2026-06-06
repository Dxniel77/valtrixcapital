"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore } from "@/lib/admin/store";
import { buildUserDetail, findAdminUser } from "@/lib/admin/analytics";
import { formatNumber, shortenAddress } from "@/lib/utils";

export default function AdminLookupPage() {
  const { t } = useI18n();
  const users = useAdminStore((s) => s.users);
  const movements = useAdminStore((s) => s.movements);
  const [query, setQuery] = React.useState("");

  const user = React.useMemo(
    () => findAdminUser(users, query),
    [users, query],
  );
  const detail = React.useMemo(
    () => (user ? buildUserDetail(user, users, movements) : null),
    [user, users, movements],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.lookup.title")}
        subtitle={t("admin.lookup.subtitle")}
        actions={
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("admin.lookup.searchPlaceholder")}
              className="pl-8"
            />
          </div>
        }
      />

      {!query.trim() ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-text-muted">
            {t("admin.lookup.emptyPrompt")}
          </CardContent>
        </Card>
      ) : !detail ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-text-muted">
            {t("admin.lookup.notFound")}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Stat label={t("admin.lookup.capital")} value={`$${formatNumber(detail.totals.capital, { decimals: 0 })}`} />
            <Stat label={t("admin.lookup.balance")} value={`$${formatNumber(detail.totals.balance, { decimals: 2 })}`} />
            <Stat label={t("admin.lookup.directRefs")} value={String(detail.totals.directReferrals)} />
            <Stat label={t("admin.lookup.networkSize")} value={String(detail.totals.networkSize)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{detail.user.alias}</CardTitle>
              <p className="font-mono text-xs text-text-muted">
                {detail.user.wallet}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={detail.user.status === "ACTIVE" ? "success" : "default"}>
                  {detail.user.status}
                </Badge>
                {detail.user.accountGranted ? (
                  <Badge variant="gold">{t("admin.lookup.granted")}</Badge>
                ) : null}
                {detail.user.withdrawalUnlocked ? (
                  <Badge variant="success">{t("admin.lookup.withdrawOk")}</Badge>
                ) : detail.user.accountGranted ? (
                  <Badge variant="warning">{t("admin.lookup.withdrawLocked")}</Badge>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-xs text-text-muted">{t("admin.lookup.operational")}</p>
                  <p className="font-mono">${formatNumber(detail.totals.operational, { decimals: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">{t("admin.lookup.network")}</p>
                  <p className="font-mono">${formatNumber(detail.totals.network, { decimals: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">{t("admin.lookup.passive")}</p>
                  <p className="font-mono">${formatNumber(detail.totals.passive, { decimals: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.lookup.networkLevels")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <thead>
                  <THeadRow>
                    <TH>{t("admin.lookup.level")}</TH>
                    <TH className="text-right">{t("admin.lookup.members")}</TH>
                    <TH className="text-right">{t("admin.lookup.volume")}</TH>
                  </THeadRow>
                </thead>
                <TBody>
                  {detail.networkByLevel.map((row) => (
                    <TR key={row.level}>
                      <TD>L{row.level}</TD>
                      <TD className="text-right font-mono">{row.count}</TD>
                      <TD className="text-right font-mono">
                        ${formatNumber(row.volume, { decimals: 0 })}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.lookup.history")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <thead>
                  <THeadRow>
                    <TH>{t("admin.movements.colDate")}</TH>
                    <TH>{t("admin.movements.colType")}</TH>
                    <TH className="text-right">{t("admin.movements.colAmount")}</TH>
                    <TH>{t("admin.movements.colStatus")}</TH>
                  </THeadRow>
                </thead>
                <TBody>
                  {detail.movements.slice(0, 30).map((m) => (
                    <TR key={m.id}>
                      <TD className="text-xs text-text-muted">
                        {new Date(m.timestamp).toLocaleString()}
                      </TD>
                      <TD>{m.type}</TD>
                      <TD className="text-right font-mono">
                        ${formatNumber(m.amount, { decimals: 2 })}
                      </TD>
                      <TD>{m.status}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-text-muted">{label}</p>
        <p className="mt-1 font-mono text-xl text-text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}
