"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Handshake, Gauge } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";
import { formatNumber, shortenAddress } from "@/lib/utils";
import { IbBoostBadge } from "@/components/ib/ib-boost-badge";

interface IbAgreementRow {
  id: string;
  userId: string;
  isIb: boolean;
  netDepositEnabled: boolean;
  level1DepositBps: number;
  level2DepositBps: number;
  includeLevel2: boolean;
  notes: string;
  walletAddress: string;
  displayName: string;
  totalCredited: number;
  creditCount: number;
  yieldStrategyName: string | null;
}

interface IbStrategyRow {
  id: string;
  name: string;
  passiveBonusBps: number;
  tradeBonusExtraBps: number;
  isActive: boolean;
  userCount: number;
}

export default function AdminIbPage() {
  const { t } = useI18n();
  const [agreements, setAgreements] = React.useState<IbAgreementRow[]>([]);
  const [strategies, setStrategies] = React.useState<IbStrategyRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        agreements: IbAgreementRow[];
        strategies: IbStrategyRow[];
      }>("/api/admin/ib");
      setAgreements(res.agreements);
      setStrategies(res.strategies);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.ib.title")}
        subtitle={t("admin.ib.monitorSubtitle")}
      />

      <Card className="border-gold/25 bg-gold/5">
        <CardContent className="space-y-2 p-4 text-sm text-text-secondary">
          <p>{t("admin.ib.netDepositPrinciple")}</p>
          <p>{t("admin.ib.netDepositNote")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Handshake className="h-4 w-4 text-gold" />
            {t("admin.ib.monitorTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-text-muted">{t("common.loading")}</p>
          ) : agreements.length === 0 ? (
            <p className="text-sm text-text-muted">{t("admin.ib.monitorEmpty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <THeadRow>
                    <TH>{t("admin.ib.colUser")}</TH>
                    <TH>{t("admin.ib.colNegotiation")}</TH>
                    <TH className="text-right">{t("admin.ib.colCredited")}</TH>
                    <TH>{t("admin.ib.colYieldBoost")}</TH>
                    <TH />
                  </THeadRow>
                </thead>
                <TBody>
                  {agreements.map((a) => (
                    <TR key={a.id}>
                      <TD>
                        <p className="font-medium text-text-primary">
                          {a.displayName}
                          <Badge variant="gold" className="ml-1.5">
                            IB
                          </Badge>
                        </p>
                        <p className="font-mono text-xs text-text-muted">
                          {shortenAddress(a.walletAddress)}
                        </p>
                        {a.notes ? (
                          <p className="mt-1 text-xs text-text-secondary">
                            {a.notes}
                          </p>
                        ) : null}
                      </TD>
                      <TD>
                        {a.netDepositEnabled ? (
                          <div className="space-y-1 text-sm">
                            <Badge variant="success">
                              {t("admin.ib.netDepositOn")}
                            </Badge>
                            <p className="font-mono text-xs text-text-secondary">
                              L1 {formatNumber(a.level1DepositBps / 100, { decimals: 2 })}%
                              {a.includeLevel2
                                ? ` · L2 ${formatNumber(a.level2DepositBps / 100, { decimals: 2 })}%`
                                : ` · ${t("admin.ib.l1Only")}`}
                            </p>
                          </div>
                        ) : (
                          <Badge variant="outline">
                            {t("admin.ib.netDepositOff")}
                          </Badge>
                        )}
                      </TD>
                      <TD className="text-right font-mono text-sm">
                        ${formatNumber(a.totalCredited, { decimals: 2 })}
                        <p className="text-xs text-text-muted">
                          {t("admin.ib.creditCount", {
                            n: String(a.creditCount),
                          })}
                        </p>
                      </TD>
                      <TD>
                        {a.yieldStrategyName ? (
                          <IbBoostBadge
                            boost={{ name: a.yieldStrategyName }}
                            showName
                            compact
                          />
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </TD>
                      <TD className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/users/${a.userId}`}>
                            {t("admin.ib.openUser")}
                          </Link>
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-gold" />
            {t("admin.ib.yieldStrategiesTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-text-secondary">
            {t("admin.ib.yieldStrategiesHint")}
          </p>
          {strategies.length === 0 ? (
            <p className="text-sm text-text-muted">{t("admin.ib.empty")}</p>
          ) : (
            strategies.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2"
              >
                <div>
                  <p className="font-medium text-text-primary">
                    {s.name}{" "}
                    <Badge variant={s.isActive ? "success" : "default"}>
                      {s.isActive ? t("admin.ib.active") : t("admin.ib.inactive")}
                    </Badge>
                  </p>
                  <p className="font-mono text-xs text-text-muted">
                    +{formatNumber(s.passiveBonusBps / 100, { decimals: 2 })}%/day
                    · {t("admin.ib.userCount", { n: String(s.userCount) })}
                  </p>
                </div>
              </div>
            ))
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/ib/strategies">{t("admin.ib.manageStrategies")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
