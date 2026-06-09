"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { UserDetailPanel } from "@/components/admin/user-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore } from "@/lib/admin/store";
import { buildUserDetail, findAdminUser } from "@/lib/admin/analytics";

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
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/users/${detail.user.id}`}>
                {t("admin.userDetail.openFull")}
              </Link>
            </Button>
          </div>
          <UserDetailPanel detail={detail} showBack={false} />
        </>
      )}
    </div>
  );
}
