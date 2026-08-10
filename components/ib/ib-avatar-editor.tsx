"use client";

import * as React from "react";
import { toast } from "sonner";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";
import { compressAvatarFile } from "@/lib/user/compress-avatar-client";

/** IB-only: pick a local image, compress, store in Neon. */
export function IbAvatarEditor({
  avatarUrl,
  onSaved,
}: {
  avatarUrl: string | null | undefined;
  onSaved?: (url: string | null) => void;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = React.useState<string | null>(avatarUrl ?? null);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setPreview(avatarUrl ?? null);
  }, [avatarUrl]);

  async function onFile(file: File | null) {
    if (!file) return;
    setSaving(true);
    try {
      const { dataUrl, mime } = await compressAvatarFile(file);
      const res = await apiFetch<{
        backend: boolean;
        user: { avatarUrl?: string | null };
      }>("/api/users/me/avatar", {
        method: "POST",
        body: JSON.stringify({ dataBase64: dataUrl, mime }),
      });
      const saved = res.user?.avatarUrl ?? null;
      setPreview(saved);
      onSaved?.(saved);
      toast.success(t("dashboard.pages.profile.avatarSaved"));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "INVALID_TYPE" || code === "TOO_LARGE") {
        toast.error(t("dashboard.pages.profile.avatarInvalid"));
      } else {
        toast.error(
          err instanceof Error ? err.message : t("errors.signInFailed"),
        );
      }
    } finally {
      setSaving(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function clear() {
    setSaving(true);
    try {
      await apiFetch("/api/users/me/avatar", { method: "DELETE" });
      setPreview(null);
      onSaved?.(null);
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
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
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
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={saving}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {t("dashboard.pages.profile.avatarUpload")}
        </Button>
        {preview ? (
          <Button
            variant="ghost"
            size="sm"
            loading={saving}
            onClick={() => void clear()}
          >
            <Trash2 className="h-4 w-4" />
            {t("dashboard.pages.profile.avatarClear")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
