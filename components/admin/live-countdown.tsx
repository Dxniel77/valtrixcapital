"use client";

import * as React from "react";
import {
  formatCopyClock,
  formatCopyRemaining,
} from "@/lib/copy-trading/format-countdown";

export function LiveCountdown({
  iso,
  dueLabel,
}: {
  iso: string | null;
  dueLabel: string;
}) {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!iso) return <span>—</span>;
  const remaining = formatCopyRemaining(iso, nowMs);
  if (remaining === "due" || remaining == null) return <span>{dueLabel}</span>;
  return (
    <span className="font-mono">
      {remaining}
      <span className="text-text-muted"> · {formatCopyClock(iso)}</span>
    </span>
  );
}
