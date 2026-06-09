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
}

export function NetworkMembersPanel({
  members,
  levelStats,
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

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>{t("referralsPage.membersTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {levelStats.map((lvl) => {
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
                      <table className="w-full min-w-[520px] text-left text-xs">
                        <thead>
                          <tr className="border-b border-border-subtle bg-bg-base/30 text-[10px] uppercase tracking-wider text-text-muted">
                            <th className="px-3 py-2 font-semibold">
                              {t("referralsPage.colMember")}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t("referralsPage.colCapital")}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t("referralsPage.colStatus")}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t("referralsPage.colJoined")}
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
                                ${formatNumber(m.capital, { decimals: 0 })}
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
        })}
      </CardContent>
    </Card>
  );
}

function formatJoined(ts: number): string {
  const days = Math.max(1, Math.floor((Date.now() - ts) / 86_400_000));
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}m`;
  return `${Math.floor(months / 12)}a`;
}
