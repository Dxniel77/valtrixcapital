function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function canShareFile(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

/**
 * Triggers a file download in the browser. Uses the Web Share API on mobile
 * when available (required for iOS), otherwise falls back to a programmatic
 * anchor click with a delayed blob URL revoke.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;

  const type = blob.type || "application/octet-stream";
  const file = new File([blob], filename, { type });

  if (isMobileDevice() && canShareFile(file)) {
    void navigator.share({ files: [file], title: filename }).catch((err: unknown) => {
      if (err instanceof Error && err.name === "AbortError") return;
      anchorDownload(blob, filename);
    });
    return;
  }

  anchorDownload(blob, filename);
}

function anchorDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.position = "fixed";
  anchor.style.left = "-9999px";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Revoke after the browser has time to start the download (mobile needs this).
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  triggerDownload(dataUrlToBlob(dataUrl), filename);
}

export function downloadText(
  filename: string,
  content: string,
  mime = "text/csv;charset=utf-8;",
): void {
  triggerDownload(new Blob([content], { type: mime }), filename);
}
