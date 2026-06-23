"use client";

import * as React from "react";

/**
 * Last-resort error boundary for the root layout.
 *
 * Renders its own <html>/<body> (required by Next.js) and is intentionally
 * dependency-free — no providers, i18n, or design-system imports — so it can
 * still render even if those subsystems are what failed. Replaces the bare
 * "Application error: a client-side exception has occurred" screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[global] fatal render error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0A0A0F",
          color: "#E7E7EA",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "1rem",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#9A9AA3", margin: "0 0 24px" }}>
            The app hit an unexpected error. Please try again.
          </p>
          {error.digest ? (
            <p
              style={{
                fontSize: 11,
                color: "#6B6B73",
                fontFamily: "ui-monospace, monospace",
                margin: "0 0 24px",
              }}
            >
              Ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: "#D4AF37",
              color: "#0A0A0F",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
