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
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    setUsername(user.alias);
  }, [user.id, user.alias]);

  async function saveProfile() {
    setSaving(true);
    try {
      const trimmed = username.trim();
      await apiFetch(`/api/admin/users/${user.id}/profile`, {
        method: "PATCH",
        body: JSON.stringify({
          username: trimmed || undefined,
          email: email.trim() || null,
        }),
      });
      if (trimmed) {
        updateUserProfile(user.id, { username: trimmed });
      }
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
