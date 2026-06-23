"use client";

import * as React from "react";
import { FileText, Paperclip } from "lucide-react";
import type { SupportAttachmentDto } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function SupportThreadBubble({
  label,
  body,
  time,
  staff,
  attachments = [],
}: {
  label: string;
  body: string;
  time: number;
  staff: boolean;
  attachments?: SupportAttachmentDto[];
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        staff
          ? "border-gold/30 bg-gold/5"
          : "border-border-subtle bg-bg-hover/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
        <span className="font-medium text-text-secondary">{label}</span>
        <span>
          {new Date(time).toLocaleString("es-ES", {
            timeZone: "UTC",
            hour12: false,
          })}
        </span>
      </div>
      {body && body !== "—" ? (
        <p className="mt-2 text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
          {body}
        </p>
      ) : null}
      <SupportAttachmentList attachments={attachments} />
    </div>
  );
}

export function SupportAttachmentList({
  attachments,
}: {
  attachments: SupportAttachmentDto[];
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((file) => (
        <SupportAttachmentItem key={file.id} file={file} />
      ))}
    </div>
  );
}

function SupportAttachmentItem({ file }: { file: SupportAttachmentDto }) {
  const isImage = file.mimeType.startsWith("image/");

  if (isImage) {
    return (
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-md border border-border-subtle bg-bg-base"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.url}
          alt={file.fileName}
          className="h-24 w-24 object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-2.5 py-1.5 text-xs text-text-primary hover:border-gold/40"
    >
      <FileText className="h-3.5 w-3.5 text-gold" />
      <span className="max-w-[160px] truncate">{file.fileName}</span>
    </a>
  );
}

export function SupportAttachmentPicker({
  files,
  onChange,
  disabled,
  hint,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addFiles(next: FileList | null) {
    if (!next?.length) return;
    onChange([...files, ...Array.from(next)].slice(0, 5));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs text-text-secondary hover:bg-bg-hover disabled:opacity-50"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {hint}
        </button>
        {files.map((file, index) => (
          <span
            key={`${file.name}-${index}`}
            className="inline-flex items-center gap-1 rounded-md bg-bg-hover px-2 py-1 text-[11px] text-text-secondary"
          >
            <span className="max-w-[120px] truncate">{file.name}</span>
            <button
              type="button"
              className="text-text-muted hover:text-danger"
              onClick={() => onChange(files.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
