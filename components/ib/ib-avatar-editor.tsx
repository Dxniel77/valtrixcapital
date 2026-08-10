"use client";

import * as React from "react";
import { toast } from "sonner";
import { ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";

/** IB-only avatar URL editor (self-service on profile). */
export function IbAvatarEditor({
  avatarUrl,
  onSaved,
}: {
  avatarUrl: string | null | undefined;
  onSaved?: (url: string | null) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = React.useState(avatarUrl ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setValue(avatarUrl ?? "");
  }, [avatarUrl]);

  async function save(next: string | null) {
    setSaving(true);
    try {
      const res = await apiFetch<{
        backend: boolean;
        user: { avatarUrl?: string | null };
      }>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl: next }),
      });
      const saved = res.user?.avatarUrl ?? null;
      setValue(saved ?? "");
      onSaved?.(saved);
      toast.success(t("dashboard.pages.profile.avatarSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-gold/25 bg-gold/5 p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/40 bg-bg-elevated">
          {value.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.trim()}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-gold/70" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-medium text-text-primary">
            {t("dashboard.pages.profile.avatarTitle")}
          </p>
          <p className="text-[11px] text-text-muted">
            {t("dashboard.pages.profile.avatarHint")}
          </p>
        </div>
      </div>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://…"
        className="font-mono text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={saving}
          onClick={() => void save(value.trim() || null)}
        >
          {t("dashboard.pages.profile.avatarSave")}
        </Button>
        {avatarUrl ? (
          <Button
            variant="ghost"
            size="sm"
            loading={saving}
            onClick={() => void save(null)}
          >
            <Trash2 className="h-4 w-4" />
            {t("dashboard.pages.profile.avatarClear")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
