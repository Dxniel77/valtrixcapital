"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n/context";
import { useAccount } from "wagmi";
import { useSiwe } from "@/lib/hooks/use-siwe";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { apiFetch, fetchCurrentUser } from "@/lib/api/client";
import { useUserRegistry } from "@/lib/user/store";

interface DeletionRequest {
  status: string;
  scheduledFor: string | null;
}

export function ProfileSettingsCard() {
  const { t } = useI18n();
  const backend = useBackendAvailable();
  const { address } = useAccount();
  const { refresh } = useSiwe();
  const getProfile = useUserRegistry((s) => s.getProfile);
  const upsertProfileFromServer = useUserRegistry((s) => s.upsertProfileFromServer);
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deletion, setDeletion] = React.useState<DeletionRequest | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!backend) return;
    void fetchCurrentUser()
      .then((data) => {
        if (data.user?.username) setUsername(data.user.username);
      })
      .catch(() => undefined);
  }, [backend]);

  React.useEffect(() => {
    if (!backend) return;
    void apiFetch<{ request: DeletionRequest | null }>("/api/users/me/deletion")
      .then((data) => setDeletion(data.request))
      .catch(() => setDeletion(null));
  }, [backend]);

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await apiFetch<{ user: { username: string | null } }>(
        "/api/users/me",
        {
          method: "PATCH",
          body: JSON.stringify({
            username: username.trim() || undefined,
            email: email.trim() || null,
          }),
        },
      );
      toast.success(t("profileSettings.saved"));
      await refresh();
      const profile = getProfile(address);
      if (profile && res.user.username) {
        upsertProfileFromServer({ ...profile, username: res.user.username });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function requestDeletion() {
    if (!window.confirm(t("profileSettings.deleteConfirm"))) return;
    setDeleting(true);
    try {
      const res = await apiFetch<{ request: DeletionRequest }>(
        "/api/users/me/deletion",
        { method: "POST", body: JSON.stringify({}) },
      );
      setDeletion(res.request);
      toast.success(t("profileSettings.deleteRequested"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setDeleting(false);
    }
  }

  async function cancelDeletion() {
    setDeleting(true);
    try {
      await apiFetch("/api/users/me/deletion", { method: "DELETE" });
      setDeletion(null);
      toast.success(t("profileSettings.deleteCancelled"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setDeleting(false);
    }
  }

  if (!backend) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profileSettings.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-text-muted">
            {t("dashboard.pages.profile.username")}
          </label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("dashboard.pages.profile.setupPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-text-muted">
            {t("profileSettings.email")}
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>
        <Button variant="primary" size="sm" onClick={() => void saveProfile()} loading={saving}>
          <Save className="h-4 w-4" />
          {t("profileSettings.save")}
        </Button>

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-medium text-text-primary">
            {t("profileSettings.deleteTitle")}
          </p>
          <p className="text-xs text-text-secondary">{t("profileSettings.deleteDesc")}</p>
          {deletion ? (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <Badge variant="warning">{deletion.status}</Badge>
              </div>
              {deletion.scheduledFor ? (
                <p className="text-xs text-text-secondary">
                  {t("profileSettings.scheduledFor", {
                    date: new Date(deletion.scheduledFor).toLocaleDateString(),
                  })}
                </p>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => void cancelDeletion()} loading={deleting}>
                {t("profileSettings.cancelDelete")}
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="text-danger" onClick={() => void requestDeletion()} loading={deleting}>
              <Trash2 className="h-4 w-4" />
              {t("profileSettings.requestDelete")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
