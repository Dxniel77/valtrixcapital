"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  LifeBuoy,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SupportReplyComposer } from "@/components/support/support-reply-composer";
import { SupportThreadBubble } from "@/components/support/support-thread";
import { SupportTicketForm } from "@/components/support/ticket-form";
import { useI18n } from "@/lib/i18n/context";
import {
  ApiError,
  fetchUserSupportTicket,
  fetchUserSupportTickets,
  userReplySupportTicket,
  type SupportTicketDto,
} from "@/lib/api/client";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<
  string,
  "success" | "danger" | "info" | "gold" | "warning" | "default"
> = {
  open: "warning",
  pending: "info",
  resolved: "success",
  closed: "default",
};

export function UserSupportTicketsPanel() {
  const { t } = useI18n();
  const backend = useBackendAvailable();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("tkt");

  const [tickets, setTickets] = React.useState<SupportTicketDto[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<SupportTicketDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [reply, setReply] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);

  async function loadTickets(preferredId?: string | null) {
    if (!backend) {
      setTickets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetchUserSupportTickets();
      const rows = res.tickets ?? [];
      setTickets(rows);

      const pick =
        preferredId && rows.some((tk) => tk.id === preferredId)
          ? preferredId
          : selectedId && rows.some((tk) => tk.id === selectedId)
            ? selectedId
            : rows[0]?.id ?? null;

      setSelectedId(pick);
      setShowNew(rows.length === 0);
    } catch {
      toast.error(t("supportPage.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetchUserSupportTicket(id);
      setDetail(res.ticket ?? null);
    } catch {
      toast.error(t("supportPage.loadFailed"));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  React.useEffect(() => {
    void loadTickets(deepLinkId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, deepLinkId]);

  React.useEffect(() => {
    if (!selectedId || showNew) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, showNew]);

  async function handleReply() {
    if (!detail) return;

    setSubmitting(true);
    try {
      const res = await userReplySupportTicket({
        ticketId: detail.id,
        message: reply.trim(),
        files,
      });
      setDetail(res.ticket);
      setTickets((prev) =>
        prev.map((tk) => (tk.id === res.ticket.id ? res.ticket : tk)),
      );
      setReply("");
      setFiles([]);
      toast.success(t("supportPage.replySent"));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t("supportPage.actionFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleTicketCreated(id: string) {
    setShowNew(false);
    void loadTickets(id);
  }

  const canReply =
    detail && detail.status !== "closed" && detail.status !== "resolved";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">{t("supportPage.myTicketsDesc")}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadTickets()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            {t("supportPage.refresh")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setShowNew(true);
              setSelectedId(null);
            }}
          >
            <Plus className="h-4 w-4" />
            {t("supportPage.newTicket")}
          </Button>
        </div>
      </div>

      {!backend ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <LifeBuoy className="h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-secondary">
              {t("supportPage.backendOffline")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card className="overflow-hidden">
            <div className="border-b border-border-subtle px-4 py-3 text-sm text-text-secondary">
              {t("supportPage.myTicketsTitle")}
            </div>
            <div className="max-h-[560px] overflow-y-auto divide-y divide-border-subtle">
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("supportPage.loading")}
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-10 text-center">
                  <MessageSquare className="h-7 w-7 text-text-muted" />
                  <p className="text-sm text-text-secondary">
                    {t("supportPage.noTickets")}
                  </p>
                </div>
              ) : (
                tickets.map((ticket) => {
                  const active = ticket.id === selectedId && !showNew;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => {
                        setShowNew(false);
                        setSelectedId(ticket.id);
                      }}
                      className={cn(
                        "w-full px-4 py-3 text-left transition-colors hover:bg-bg-hover",
                        active && "bg-gold/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-text-primary">
                            {ticket.subject}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-text-muted font-mono">
                            {ticket.id}
                          </p>
                        </div>
                        <Badge variant={STATUS_VARIANT[ticket.status] ?? "default"}>
                          {t(`admin.support.status.${ticket.status}`)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-[11px] text-text-muted">
                        {new Date(ticket.updatedAt).toLocaleString("es-ES", {
                          timeZone: "UTC",
                          hour12: false,
                        })}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            {showNew ? (
              <CardContent className="p-4">
                <SupportTicketForm onCreated={handleTicketCreated} />
              </CardContent>
            ) : !selectedId ? (
              <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
                <LifeBuoy className="h-8 w-8 text-text-muted" />
                <p className="text-sm text-text-secondary">
                  {t("supportPage.selectTicket")}
                </p>
              </CardContent>
            ) : detailLoading || !detail ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("supportPage.loading")}
              </div>
            ) : (
              <div className="flex min-h-[560px] flex-col">
                <div className="border-b border-border-subtle p-4">
                  <h3 className="text-base font-semibold text-text-primary">
                    {detail.subject}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-gold">{detail.id}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <Badge variant={STATUS_VARIANT[detail.status] ?? "default"}>
                      {t(`admin.support.status.${detail.status}`)}
                    </Badge>
                    <span>{t(`supportPage.categories.${detail.category}`)}</span>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  <SupportThreadBubble
                    label={detail.name}
                    body={detail.message}
                    time={detail.createdAt}
                    staff={false}
                    attachments={detail.attachments}
                  />
                  {detail.replies.map((item) => (
                    <SupportThreadBubble
                      key={item.id}
                      label={
                        item.isStaff
                          ? t("supportPage.staffReply")
                          : detail.name
                      }
                      body={item.body}
                      time={item.createdAt}
                      staff={item.isStaff}
                      attachments={item.attachments}
                    />
                  ))}
                </div>

                {canReply ? (
                  <SupportReplyComposer
                    value={reply}
                    onChange={setReply}
                    files={files}
                    onFilesChange={setFiles}
                    onSubmit={handleReply}
                    submitting={submitting}
                  />
                ) : (
                  <div className="border-t border-border-subtle p-4 text-xs text-text-muted">
                    {t("supportPage.ticketClosedHint")}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
