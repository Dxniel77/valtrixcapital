"use client";

import * as React from "react";
import Link from "next/link";
import { Network, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { changeAdminUserSponsor } from "@/lib/admin/change-user-sponsor";
import { useAdminStore, type AdminUser } from "@/lib/admin/store";
import {
  findSponsorUser,
  resolveSponsorQuery,
} from "@/lib/admin/sponsor";
import { cn, shortenAddress } from "@/lib/utils";

export function ChangeSponsorCard({ user }: { user: AdminUser }) {
  const { t } = useI18n();
  const users = useAdminStore((s) => s.users);

  const currentSponsor = React.useMemo(
    () => findSponsorUser(users, user.uplineWallet),
    [users, user.uplineWallet],
  );

  const [query, setQuery] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setQuery("");
  }, [user.id, user.uplineWallet]);

  const preview = query.trim()
    ? resolveSponsorQuery(users, query)
    : null;

  async function apply(nextQuery: string | null) {
    setSubmitting(true);
    try {
      const result = await changeAdminUserSponsor(user.id, nextQuery);
      if (!result.ok) {
        const key = `admin.userDetail.sponsorErrors.${result.error}`;
        toast.error(t(key));
        return;
      }
      toast.success(t("admin.userDetail.sponsorUpdated"));
      setQuery("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Network className="h-4 w-4 text-gold" />
          {t("admin.userDetail.sponsorTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border-subtle bg-bg-base/40 p-3">
          <p className="text-xs uppercase tracking-wider text-text-muted">
            {t("admin.userDetail.sponsorCurrent")}
          </p>
          {currentSponsor ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <UserRound className="h-4 w-4 text-gold" />
              <span className="font-medium text-text-primary">
                {currentSponsor.alias}
              </span>
              <span className="font-mono text-xs text-text-muted">
                {shortenAddress(currentSponsor.wallet)}
              </span>
              <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                <Link href={`/admin/users/${currentSponsor.id}`}>
                  {t("admin.userDetail.sponsorView")}
                </Link>
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-muted">
              {t("admin.userDetail.sponsorNone")}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-text-muted">
            {t("admin.userDetail.sponsorNewLabel")}
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("admin.userDetail.sponsorPlaceholder")}
            className={cn(
              "font-mono text-sm",
              preview && preview.id === user.id && "border-danger/50",
            )}
          />
          <p className="text-[11px] text-text-muted">
            {t("admin.userDetail.sponsorHint")}
          </p>
          {preview ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-gold/25 bg-gold/5 px-3 py-2 text-xs">
              <span className="text-text-muted">
                {t("admin.userDetail.sponsorPreview")}
              </span>
              <Badge variant="gold">{preview.alias}</Badge>
              <span className="font-mono text-text-secondary">
                {shortenAddress(preview.wallet)}
              </span>
            </div>
          ) : query.trim() ? (
            <p className="text-xs text-danger">
              {t("admin.userDetail.sponsorPreviewMissing")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!preview || preview.id === user.id}
            onClick={() => void apply(query)}
          >
            {t("admin.userDetail.sponsorSave")}
          </Button>
          {currentSponsor ? (
            <Button
              variant="outline"
              size="sm"
              loading={submitting}
              onClick={() => void apply(null)}
            >
              {t("admin.userDetail.sponsorClear")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
