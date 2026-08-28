"use client";

import * as React from "react";
import { ImagePlus, Pin, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/context";
import { compressNewsImageFile } from "@/lib/news/compress-client";
import { NEWS_BODY_MAX, NEWS_TITLE_MAX } from "@/lib/news/image";

type NewsPost = {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  published: boolean;
  pinned: boolean;
  hasImage: boolean;
  imageUrl: string | null;
  createdAt: string;
  publishedAt: string | null;
};

const EMPTY = {
  title: "",
  body: "",
  published: true,
  pinned: false,
  notify: false,
};

export function AdminNewsPanel() {
  const { t } = useI18n();
  const [posts, setPosts] = React.useState<NewsPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState(EMPTY.title);
  const [body, setBody] = React.useState(EMPTY.body);
  const [published, setPublished] = React.useState(EMPTY.published);
  const [pinned, setPinned] = React.useState(EMPTY.pinned);
  const [notify, setNotify] = React.useState(EMPTY.notify);
  const [imageDataUrl, setImageDataUrl] = React.useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = React.useState<string | null>(null);
  const [clearImage, setClearImage] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    try {
      const data = await apiFetch<{ posts: NewsPost[] }>("/api/admin/news");
      setPosts(data.posts ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("admin.news.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setPublished(true);
    setPinned(false);
    setNotify(false);
    setImageDataUrl(null);
    setExistingImageUrl(null);
    setClearImage(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function editPost(post: NewsPost) {
    setEditingId(post.id);
    setTitle(post.title);
    setBody(post.body);
    setPublished(post.published);
    setPinned(post.pinned);
    setNotify(false);
    setImageDataUrl(null);
    setExistingImageUrl(post.imageUrl);
    setClearImage(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    try {
      const compressed = await compressNewsImageFile(file);
      setImageDataUrl(compressed.dataUrl);
      setExistingImageUrl(null);
      setClearImage(false);
    } catch {
      toast.error(t("admin.news.imageInvalid"));
    }
  }

  function removeImage() {
    setImageDataUrl(null);
    setExistingImageUrl(null);
    setClearImage(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      toast.error(t("admin.news.validation"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: trimmedTitle,
        body: trimmedBody,
        published,
        pinned,
        notify,
        clearImage: clearImage && !imageDataUrl,
        image: imageDataUrl
          ? { dataBase64: imageDataUrl, mime: "image/jpeg" }
          : undefined,
      };
      if (editingId) {
        await apiFetch(`/api/admin/news/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success(t("admin.news.saved"));
      } else {
        await apiFetch("/api/admin/news", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(t("admin.news.publishedToast"));
      }
      resetForm();
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("admin.news.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("admin.news.deleteConfirm"))) return;
    try {
      await apiFetch(`/api/admin/news/${id}`, { method: "DELETE" });
      toast.success(t("admin.news.deleted"));
      if (editingId === id) resetForm();
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("admin.news.saveFailed"),
      );
    }
  }

  const preview = imageDataUrl ?? existingImageUrl;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingId ? t("admin.news.editTitle") : t("admin.news.composeTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void save(e)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-text-muted">
                {t("admin.news.titleLabel")}
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={NEWS_TITLE_MAX}
                placeholder={t("admin.news.titlePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-text-muted">
                {t("admin.news.bodyLabel")}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("admin.news.bodyPlaceholder")}
                maxLength={NEWS_BODY_MAX}
                rows={8}
                className="w-full rounded-md border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-gold/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-text-muted">
                {t("admin.news.imageLabel")}
              </label>
              {preview ? (
                <div className="relative overflow-hidden rounded-md border border-border-subtle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt=""
                    className="max-h-56 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                    aria-label={t("admin.news.removeImage")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-subtle px-3 py-8 text-sm text-text-muted hover:border-gold/40 hover:text-text-secondary"
                >
                  <ImagePlus className="h-4 w-4" />
                  {t("admin.news.imageHint")}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void onPickImage(e.target.files?.[0])}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              {t("admin.news.publishNow")}
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              {t("admin.news.pin")}
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                disabled={!published}
              />
              {t("admin.news.notify")}
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="gap-2" disabled={saving}>
                <Send className="h-4 w-4" />
                {saving
                  ? t("admin.news.saving")
                  : editingId
                    ? t("admin.news.save")
                    : t("admin.news.publish")}
              </Button>
              {editingId ? (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  {t("common.cancel")}
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.news.listTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-text-muted">{t("common.loading")}</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-text-muted">{t("admin.news.empty")}</p>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="rounded-md border border-border-subtle p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => editPost(post)}
                    className="min-w-0 text-left"
                  >
                    <p className="truncate text-sm font-medium text-text-primary">
                      {post.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                      {post.excerpt}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(post.id)}
                    className="shrink-0 rounded-md p-1 text-text-muted hover:text-danger"
                    aria-label={t("admin.news.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant={post.published ? "success" : "default"}>
                    {post.published
                      ? t("admin.news.statusPublished")
                      : t("admin.news.statusDraft")}
                  </Badge>
                  {post.pinned ? (
                    <Badge variant="gold">
                      <Pin className="h-3 w-3" />
                      {t("admin.news.statusPinned")}
                    </Badge>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
