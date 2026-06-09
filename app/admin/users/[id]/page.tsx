"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { UserDetailPanel } from "@/components/admin/user-detail-panel";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore } from "@/lib/admin/store";
import { buildUserDetail, findAdminUserById } from "@/lib/admin/analytics";

export default function AdminUserDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = String(params.id ?? "");
  const users = useAdminStore((s) => s.users);
  const movements = useAdminStore((s) => s.movements);

  const user = React.useMemo(
    () => findAdminUserById(users, id),
    [users, id],
  );
  const detail = React.useMemo(
    () => (user ? buildUserDetail(user, users, movements) : null),
    [user, users, movements],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.userDetail.title")}
        subtitle={user ? user.alias : t("admin.userDetail.notFound")}
      />

      {!detail ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-text-muted">
            {t("admin.userDetail.notFound")}
          </CardContent>
        </Card>
      ) : (
        <UserDetailPanel detail={detail} backHref="/admin/users" />
      )}
    </div>
  );
}
