"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/context";
import { useSiwe } from "@/lib/hooks/use-siwe";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { apiFetch, fetchCurrentUser } from "@/lib/api/client";

interface PendingTerms {
  id: string;
  version: number;
  title: string;
  content: string;
}

export function SponsorTermsGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const backend = useBackendAvailable();
  const { checked } = useSiwe();
  const [pending, setPending] = React.useState<PendingTerms | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [accepting, setAccepting] = React.useState(false);
  const [scrolledToEnd, setScrolledToEnd] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!backend || !checked) {
      setPending(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchCurrentUser()
      .then((me) => {
        if (cancelled || !me.user?.accountGranted) {
          if (!cancelled) setPending(null);
          return;
        }
        return apiFetch<{ pending: PendingTerms | null }>("/api/sponsor-terms");
      })
      .then((data) => {
        if (!cancelled && data) setPending(data.pending);
      })
      .catch(() => {
        if (!cancelled) setPending(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [backend, checked]);

  function handleScroll() {
    const el = contentRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    if (atBottom) setScrolledToEnd(true);
  }

  async function accept() {
    if (!pending) return;
    setAccepting(true);
    try {
      await apiFetch("/api/sponsor-terms/accept", {
        method: "POST",
        body: JSON.stringify({ termsVersionId: pending.id }),
      });
      toast.success(t("sponsorTerms.accepted"));
      setPending(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setAccepting(false);
    }
  }

  const blocked = !!pending && !loading;

  return (
    <>
      <div className={blocked ? "pointer-events-none select-none blur-sm" : undefined}>
        {children}
      </div>
      <Dialog open={blocked} onOpenChange={() => undefined}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gold" />
              {pending?.title ?? t("sponsorTerms.title")}
            </DialogTitle>
            <DialogDescription>
              {t("sponsorTerms.description", { version: pending?.version ?? 0 })}
            </DialogDescription>
          </DialogHeader>
          <div
            ref={contentRef}
            onScroll={handleScroll}
            className="max-h-[45vh] overflow-y-auto rounded-md border border-border-subtle bg-bg-base/50 p-4 text-sm leading-relaxed text-text-secondary whitespace-pre-wrap"
          >
            {pending?.content}
          </div>
          {!scrolledToEnd ? (
            <p className="text-xs text-text-muted">{t("sponsorTerms.scrollHint")}</p>
          ) : null}
          <DialogFooter>
            <Button
              variant="primary"
              onClick={() => void accept()}
              disabled={!scrolledToEnd || accepting}
              loading={accepting}
            >
              {accepting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                t("sponsorTerms.accept")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
