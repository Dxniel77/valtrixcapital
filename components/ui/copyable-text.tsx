"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { cn, shortenAddress, shortenHash } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

export function CopyableText({
  value,
  kind = "text",
  className,
}: {
  value: string;
  kind?: "address" | "tx" | "text";
  className?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = React.useState(false);
  const display =
    kind === "tx"
      ? shortenHash(value)
      : kind === "address"
        ? shortenAddress(value)
        : value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("admin.audit.copied"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("admin.audit.copyFailed"));
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={t("admin.audit.copy")}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 font-mono text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary",
        className,
      )}
    >
      <span className="truncate">{display}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-success" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 text-text-muted" />
      )}
    </button>
  );
}
