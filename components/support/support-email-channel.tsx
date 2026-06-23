"use client";

import * as React from "react";
import { Copy, ExternalLink, Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/context";
import { SUPPORT_EMAIL } from "@/lib/support/constants";
import {
  buildGmailComposeUrl,
  buildMailtoUrl,
  openMailtoUrl,
} from "@/lib/support/mailto";
import { cn } from "@/lib/utils";

export function SupportEmailChannel() {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setSubject(t("supportPage.emailSubjectDefault"));
    }
  }, [open, t]);

  function openComposeDialog() {
    setOpen(true);
  }

  function openInEmailApp() {
    const url = buildMailtoUrl(SUPPORT_EMAIL, subject, message);
    openMailtoUrl(url);
    setOpen(false);
  }

  function openInGmail() {
    const url = buildGmailComposeUrl(SUPPORT_EMAIL, subject, message);
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      toast.success(t("supportPage.emailCopied"));
    } catch {
      toast.error(t("supportPage.emailCopyFailed"));
    }
  }

  return (
    <>
      <Card className="transition-colors hover:border-border-strong">
        <CardContent className="flex items-start gap-3 p-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-hover text-gold">
            <Mail className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-text-primary">
              {t("dashboard.pages.support.email")}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {t("dashboard.pages.support.emailDesc")}
            </p>
            <button
              type="button"
              onClick={openComposeDialog}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-3",
              )}
            >
              {SUPPORT_EMAIL}
            </button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("supportPage.emailComposeTitle")}</DialogTitle>
            <DialogDescription>
              {t("supportPage.emailComposeDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                {t("supportPage.emailLabel")}
              </label>
              <div className="flex gap-2">
                <Input value={SUPPORT_EMAIL} readOnly className="font-mono text-sm" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void copyEmail()}
                  aria-label={t("supportPage.emailCopyLabel")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                {t("supportPage.subjectLabel")}
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("supportPage.emailSubjectDefault")}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                {t("supportPage.messageLabel")}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="flex w-full rounded-md border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                placeholder={t("supportPage.emailComposeMessagePlaceholder")}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="flex-1" onClick={openInEmailApp}>
                <Mail className="h-4 w-4" />
                {t("supportPage.emailComposeOpen")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={openInGmail}
              >
                <ExternalLink className="h-4 w-4" />
                {t("supportPage.emailComposeGmail")}
              </Button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
