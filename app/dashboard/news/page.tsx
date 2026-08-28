"use client";

import * as React from "react";
import Link from "next/link";
import { Newspaper, Pin } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/context";

type NewsPost = {
  id: string;
  title: string;
  excerpt: string;
  hasImage: boolean;
  imageUrl: string | null;
  pinned: boolean;
  publishedAt: string | null;
  createdAt: string;
};

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function NewsPage() {
  const { t, locale } = useI18n();
  const [posts, setPosts] = React.useState<NewsPost[] | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch<{ posts: NewsPost[] }>("/api/news")
      .then((data) => {
        if (!cancelled) setPosts(data.posts ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.pages.news.title")}
        subtitle={t("dashboard.pages.news.subtitle")}
      />
      {error ? (
        <p className="text-sm text-text-muted">{t("dashboard.pages.news.loadFailed")}</p>
      ) : posts == null ? (
        <p className="text-sm text-text-muted">{t("common.loading")}</p>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Newspaper className="h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-muted">{t("dashboard.pages.news.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <Link key={post.id} href={`/dashboard/news/${post.id}`} className="block h-full">
              <Card interactive className="h-full overflow-hidden">
                {post.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.imageUrl}
                    alt=""
                    className="h-40 w-full object-cover"
                  />
                ) : null}
                <CardContent className={post.imageUrl ? "pt-4" : undefined}>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold text-text-primary">
                      {post.title}
                    </h2>
                    {post.pinned ? (
                      <Pin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-text-secondary">
                    {post.excerpt}
                  </p>
                  <p className="mt-3 text-xs text-text-muted">
                    {formatDate(post.publishedAt ?? post.createdAt, locale)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
