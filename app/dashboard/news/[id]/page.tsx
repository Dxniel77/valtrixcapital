"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/context";

type NewsPost = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
};

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function NewsDetailPage() {
  const { t, locale } = useI18n();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [post, setPost] = React.useState<NewsPost | null | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch<{ post: NewsPost }>(`/api/news/${id}`)
      .then((data) => {
        if (!cancelled) setPost(data.post);
      })
      .catch(() => {
        if (!cancelled) setPost(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/news"
        className="inline-flex items-center gap-1.5 text-sm text-gold hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("dashboard.pages.news.back")}
      </Link>
      {post === undefined ? (
        <p className="text-sm text-text-muted">{t("common.loading")}</p>
      ) : post == null ? (
        <p className="text-sm text-text-muted">{t("dashboard.pages.news.notFound")}</p>
      ) : (
        <>
          <PageHeader
            title={post.title}
            subtitle={formatDate(post.publishedAt ?? post.createdAt, locale)}
          />
          <Card className="overflow-hidden">
            {post.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.imageUrl}
                alt=""
                className="max-h-[420px] w-full object-cover"
              />
            ) : null}
            <CardContent className="whitespace-pre-wrap py-6 text-sm leading-relaxed text-text-secondary">
              {post.body}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
