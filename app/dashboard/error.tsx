"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";

/**
 * Route-segment error boundary for the dashboard.
 *
 * Contains client-side render errors (e.g. an unexpected exception in a single
 * panel) to the dashboard area instead of letting them crash the whole app to
 * Next.js' bare "Application error" screen. Offers an in-place retry so the
 * user can recover without a full reload.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surface for production diagnostics (Vercel logs / monitoring).
    console.error("[dashboard] render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="surface-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
          <AlertTriangle className="h-6 w-6 text-warning" />
        </div>
        <h1 className="text-lg font-semibold text-text-primary">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          This section ran into an unexpected error. You can try again — your
          balance and data are safe.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-text-muted">
            Ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-bg-base transition-opacity hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border-subtle px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <LayoutDashboard className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
