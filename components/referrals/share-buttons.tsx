"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

export function ShareButtons({ link }: { link: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success(t("referralsPage.copied"));
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("referralsPage.copyFailed"));
    }
  }

  const text = encodeURIComponent(t("referralsPage.shareText"));
  const url = encodeURIComponent(link);
  const telegram = `https://t.me/share/url?url=${url}&text=${text}`;
  const whatsapp = `https://wa.me/?text=${text}%20${url}`;
  const twitter = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" size="md" onClick={copy}>
        {copied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        {copied ? t("referralsPage.copiedShort") : t("referralsPage.copyLink")}
      </Button>
      <Button asChild variant="outline" size="md">
        <a href={telegram} target="_blank" rel="noreferrer">
          <Send className="h-4 w-4" /> Telegram
        </a>
      </Button>
      <Button asChild variant="outline" size="md">
        <a href={whatsapp} target="_blank" rel="noreferrer">
          <Share2 className="h-4 w-4" /> WhatsApp
        </a>
      </Button>
      <Button asChild variant="ghost" size="md">
        <a href={twitter} target="_blank" rel="noreferrer">
          <Share2 className="h-4 w-4" /> X
        </a>
      </Button>
    </div>
  );
}
