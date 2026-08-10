"use client";

import * as React from "react";
import { toast } from "sonner";
import { Save, Trash2, Upload, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";
import { useAdminStore, type AdminUser } from "@/lib/admin/store";
import { compressAvatarFile } from "@/lib/user/compress-avatar-client";

export function AdminUserAccountCard({ user }: { user: AdminUser }) {
  const { t } = useI18n();
  const updateUserProfile = useAdminStore((s) => s.updateUserProfile);
  const removeUser = useAdminStore((s) => s.removeUser);
  const [username, setUsername] = React.useState(user.alias);
  const [email, setEmail] = React.useState("");
  const [avatarPreview, setAvatarPreview] = React.useState(user.avatarUrl ?? "");
  const [saving, setSaving] = React.useState(false);
  const [avatarSaving, setAvatarSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setUsername(user.alias);
    setAvatarPreview(user.avatarUrl ?? "");
  }, [user.id, user.alias, user.avatarUrl]);

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

  async function onAvatarFile(file: File | null) {
    if (!file || !user.isIb) return;
    setAvatarSaving(true);
    try {
      const { dataUrl, mime } = await compressAvatarFile(file);
      const res = await apiFetch<{
        ok: boolean;
        user: { avatarUrl?: string | null } | null;
      }>(`/api/admin/users/${user.id}/avatar`, {
        method: "POST",
        body: JSON.stringify({ dataBase64: dataUrl, mime }),
      });
      const next = res.user?.avatarUrl ?? null;
      setAvatarPreview(next ?? "");
      updateUserProfile(user.id, { avatarUrl: next });
      toast.success(t("admin.userAccount.avatarSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setAvatarSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function clearAvatar() {
    if (!user.isIb) return;
    setAvatarSaving(true);
    try {
      await apiFetch(`/api/admin/users/${user.id}/avatar`, { method: "DELETE" });
      setAvatarPreview("");
      updateUserProfile(user.id, { avatarUrl: null });
      toast.success(t("admin.userAccount.avatarSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setAvatarSaving(false);
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
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.userAccount.avatarUrl")}
            </p>
            <p className="text-[11px] text-text-muted">
              {t("admin.userAccount.avatarHint")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-14 w-14 overflow-hidden rounded-full border border-border-subtle bg-bg-base">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void onAvatarFile(e.target.files?.[0] ?? null)}
              />
              <Button
                variant="outline"
                size="sm"
                loading={avatarSaving}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {t("admin.userAccount.avatarUpload")}
              </Button>
              {avatarPreview ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={avatarSaving}
                  onClick={() => void clearAvatar()}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("dashboard.pages.profile.avatarClear")}
                </Button>
              ) : null}
            </div>
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
