"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import type { DownlineMember, ReferralLevelStats } from "@/lib/referrals/store";
import { cn, formatNumber, shortenAddress } from "@/lib/utils";

interface NetworkMembersPanelProps {
  members: DownlineMember[];
  levelStats: ReferralLevelStats[];
  loading?: boolean;
}

export function NetworkMembersPanel({
  members,
  levelStats,
  loading = false,
}: NetworkMembersPanelProps) {
  const { t } = useI18n();
  const [expandedLevel, setExpandedLevel] = React.useState<number | null>(1);

  const byLevel = React.useMemo(() => {
    const map = new Map<number, DownlineMember[]>();
    for (const m of members) {
      const list = map.get(m.level) ?? [];
      list.push(m);
      map.set(m.level, list);
    }
    return map;
  }, [members]);

  const memberLevels = React.useMemo(() => {
    const populated = levelStats.filter((lvl) => lvl.total > 0);
    if (populated.length > 0) return populated;
    return levelStats.filter((lvl) => lvl.level === 1);
  }, [levelStats]);

  const directCount = members.filter((m) => m.level === 1).length;
  const networkCount = members.length - directCount;
  const activeCount = members.filter((m) => m.isActive).length;
  const totalCapital = members.reduce((acc, m) => acc + m.capital, 0);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>{t("referralsPage.membersTitle")}</CardTitle>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryChip
            label={t("referralsPage.directReferrals")}
            value={String(directCount)}
          />
          <SummaryChip
            label={t("referralsPage.networkReferrals")}
            value={String(networkCount)}
          />
          <SummaryChip
            label={t("referralsPage.activeMembers")}
            value={`${activeCount}/${members.length}`}
          />
          <SummaryChip
            label={t("referralsPage.colCapital")}
            value={`$${formatNumber(totalCapital, { decimals: 0 })}`}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-lg border border-border-subtle bg-bg-base/40"
              />
            ))}
          </div>
        ) : (
          memberLevels.map((lvl) => {
          const levelMembers = byLevel.get(lvl.level) ?? [];
          const open = expandedLevel === lvl.level;
          return (
            <div
              key={lvl.level}
              className="overflow-hidden rounded-lg border border-border-subtle"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedLevel(open ? null : lvl.level)
                }
                className="flex w-full items-center justify-between gap-3 bg-bg-base/40 px-3 py-2.5 text-left transition-colors hover:bg-bg-hover"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-text-muted transition-transform",
                      open && "rotate-180",
                    )}
                  />
                  <span className="text-sm font-medium text-text-primary">
                    {t("referrals.level", { n: lvl.level })}
                  </span>
                  {lvl.level === 1 ? (
                    <Badge variant="gold" className="text-[10px]">
                      {t("referralsPage.directLevel")}
                    </Badge>
                  ) : null}
                </div>
                <span className="shrink-0 font-mono text-xs text-text-muted">
                  <span className="text-success">{lvl.active}</span> / {lvl.total}
                </span>
              </button>

              {open ? (
                <div className="border-t border-border-subtle">
                  {levelMembers.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-text-muted">
                      {t("referralsPage.membersEmpty")}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-xs">
                        <thead>
                          <tr className="border-b border-border-subtle bg-bg-base/30 text-[10px] uppercase tracking-wider text-text-muted">
                            <th className="px-3 py-2 font-semibold">
                              {t("referralsPage.colMember")}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t("referralsPage.colLevel")}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t("referralsPage.colType")}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t("referralsPage.colCapital")}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t("referralsPage.colReferrals")}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t("referralsPage.colStatus")}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t("referralsPage.colJoined")}
                            </th>
                            <th className="px-3 py-2 text-right font-semibold">
                              {t("referralsPage.colEarned")}
                            </th>
                            <th className="px-3 py-2 text-right font-semibold">
                              {t("referralsPage.colCommissions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {levelMembers.map((m) => (
                            <tr
                              key={m.id}
                              className="border-b border-border-subtle/60 last:border-0"
                            >
                              <td className="px-3 py-2.5">
                                <p className="font-medium text-text-primary">
                                  {m.displayName ??
                                    shortenAddress(m.wallet, 6, 4)}
                                </p>
                                <p className="font-mono text-[10px] text-text-muted">
                                  {shortenAddress(m.wallet, 6, 4)}
                                </p>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-text-secondary">
                                L{m.level}
                              </td>
                              <td className="px-3 py-2.5">
                                <Badge
                                  variant={m.level === 1 ? "gold" : "default"}
                                  className="text-[10px]"
                                >
                                  {m.level === 1
                                    ? t("referralsPage.directLevel")
                                    : t("referralsPage.networkLevel")}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-text-secondary">
                                ${formatNumber(m.capital, { decimals: 0 })}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-text-secondary">
                                <span title={t("referralsPage.directReferrals")}>
                                  {m.directReferrals}
                                </span>
                                <span className="text-text-muted"> / </span>
                                <span title={t("referralsPage.networkReferrals")}>
                                  {m.networkReferrals}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <Badge
                                  variant={m.isActive ? "success" : "default"}
                                  className="text-[10px]"
                                >
                                  {m.isActive
                                    ? t("referralsPage.active")
                                    : t("referralsPage.inactive")}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 text-text-muted">
                                {formatJoined(m.joinedAt)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-text-primary">
                                ${formatNumber(m.totalEarned, { decimals: 2 })}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-success">
                                +$
                                {formatNumber(m.commissionsPaidToYou, {
                                  decimals: 2,
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })
        )}
      </CardContent>
    </Card>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-base/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-medium text-text-primary">
        {value}
      </p>
    </div>
  );
}

function formatJoined(ts: number): string {
  const days = Math.max(1, Math.floor((Date.now() - ts) / 86_400_000));
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}m`;
  return `${Math.floor(months / 12)}a`;
}
