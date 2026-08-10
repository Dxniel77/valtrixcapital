"use client";

import * as React from "react";
import { toast } from "sonner";
import { Save, Trash2, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";
import { useAdminStore, type AdminUser } from "@/lib/admin/store";

export function AdminUserAccountCard({ user }: { user: AdminUser }) {
  const { t } = useI18n();
  const updateUserProfile = useAdminStore((s) => s.updateUserProfile);
  const removeUser = useAdminStore((s) => s.removeUser);
  const [username, setUsername] = React.useState(user.alias);
  const [email, setEmail] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState(user.avatarUrl ?? "");
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    setUsername(user.alias);
    setAvatarUrl(user.avatarUrl ?? "");
  }, [user.id, user.alias, user.avatarUrl]);

  async function saveProfile() {
    setSaving(true);
    try {
      const trimmed = username.trim();
      const body: {
        username?: string;
        email: string | null;
        avatarUrl?: string | null;
      } = {
        username: trimmed || undefined,
        email: email.trim() || null,
      };
      if (user.isIb) {
        body.avatarUrl = avatarUrl.trim() || null;
      }
      await apiFetch(`/api/admin/users/${user.id}/profile`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      updateUserProfile(user.id, {
        ...(trimmed ? { username: trimmed } : {}),
        ...(user.isIb ? { avatarUrl: avatarUrl.trim() || null } : {}),
      });
      toast.success(t("admin.userAccount.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    if (!window.confirm(t("admin.userAccount.deleteConfirm"))) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/admin/users/${user.id}/account`, {
        method: "DELETE",
      });
      removeUser(user.id);
      toast.success(t("admin.userAccount.deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCog className="h-4 w-4 text-gold" />
          {t("admin.userAccount.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-text-secondary">{t("admin.userAccount.subtitle")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.userAccount.username")}
            </label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.userAccount.email")}
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
        </div>
        {user.isIb ? (
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.userAccount.avatarUrl")}
            </label>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-text-muted">
              {t("admin.userAccount.avatarHint")}
            </p>
            {avatarUrl.trim() ? (
              <div className="flex h-14 w-14 overflow-hidden rounded-full border border-border-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl.trim()}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={() => void saveProfile()} loading={saving}>
            <Save className="h-4 w-4" />
            {t("admin.userAccount.save")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            onClick={() => void deleteAccount()}
            loading={deleting}
          >
            <Trash2 className="h-4 w-4" />
            {t("admin.userAccount.delete")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
