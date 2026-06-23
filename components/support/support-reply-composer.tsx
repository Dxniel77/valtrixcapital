"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { SupportAttachmentPicker } from "@/components/support/support-thread";

export function SupportReplyComposer({
  value,
  onChange,
  files,
  onFilesChange,
  onSubmit,
  submitting,
  disabled,
  placeholder,
  submitLabel,
  extra,
}: {
  value: string;
  onChange: (value: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  disabled?: boolean;
  placeholder?: string;
  submitLabel?: string;
  extra?: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
      className="space-y-3 border-t border-border-subtle p-4"
    >
      <label className="text-xs uppercase tracking-wider text-text-muted">
        {t("supportPage.replyLabel")}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        maxLength={4000}
        disabled={disabled || submitting}
        placeholder={placeholder ?? t("supportPage.replyPlaceholder")}
        className="w-full resize-y rounded-md border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none disabled:opacity-50"
      />
      <SupportAttachmentPicker
        files={files}
        onChange={onFilesChange}
        disabled={disabled || submitting}
        hint={t("supportPage.attachFiles")}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {extra ?? <span />}
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={
            submitting || disabled || (!value.trim() && files.length === 0)
          }
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitLabel ?? t("supportPage.sendReply")}
        </Button>
      </div>
    </form>
  );
}
