"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore } from "@/lib/admin/store";
import { formatNumber, shortenAddress } from "@/lib/utils";
import { Network, UserCheck, Users } from "lucide-react";

export default function AdminNetworkPage() {
  const { t } = useI18n();
  const users = useAdminStore((s) => s.users);
  const [query, setQuery] = React.useState("");

  const roots = React.useMemo(
    () => users.filter((u) => !u.uplineWallet),
    [users],
  );

  const childrenByUpline = React.useMemo(() => {
    const map = new Map<string, typeof users>();
    for (const u of users) {
      if (!u.uplineWallet) continue;
      const arr = map.get(u.uplineWallet) ?? [];
      arr.push(u);
      map.set(u.uplineWallet, arr);
    }
    return map;
  }, [users]);

  const filteredRoots = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roots;
    return roots.filter(
      (u) =>
        u.alias.toLowerCase().includes(q) ||
        u.wallet.toLowerCase().includes(q),
    );
  }, [roots, query]);

  const totalReferrals = users.reduce((acc, u) => acc + u.referrals, 0);
  const withUpline = users.filter((u) => u.uplineWallet).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.network.title")}
        subtitle={t("admin.network.subtitle")}
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("admin.network.searchPlaceholder")}
              className="w-full pl-8 sm:w-64"
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatTile
          label={t("admin.network.roots")}
          value={String(roots.length)}
          icon={Network}
          accent="gold"
        />
        <StatTile
          label={t("admin.network.linked")}
          value={String(withUpline)}
          icon={UserCheck}
          accent="success"
        />
        <StatTile
          label={t("admin.network.totalReferrals")}
          value={String(totalReferrals)}
          icon={Users}
          accent="info"
        />
      </div>

      <div className="space-y-3">
        {filteredRoots.map((root) => {
          const kids = childrenByUpline.get(root.wallet) ?? [];
          return (
            <Card key={root.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {root.alias}
                    <span className="ml-2 font-mono text-xs text-text-muted">
                      {shortenAddress(root.wallet)}
                    </span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{root.network}</Badge>
                    <Badge variant="gold">
                      {t("admin.network.downlineCount", { n: kids.length })}
                    </Badge>
                    <span className="font-mono text-sm text-gold">
                      ${formatNumber(root.capital, { decimals: 0 })}
                    </span>
                  </div>
                </div>
              </CardHeader>
              {kids.length > 0 ? (
                <CardContent>
                  <ul className="space-y-1.5">
                    {kids.map((k) => (
                      <li
                        key={k.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-bg-base/40 px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-text-primary">{k.alias}</span>
                          <span className="font-mono text-xs text-text-muted">
                            {shortenAddress(k.wallet)}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge
                            variant={k.status === "ACTIVE" ? "success" : "default"}
                          >
                            {k.status === "ACTIVE"
                              ? t("admin.users.active")
                              : t("admin.users.inactive")}
                          </Badge>
                          <span className="font-mono text-text-secondary">
                            ${formatNumber(k.capital, { decimals: 0 })}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
