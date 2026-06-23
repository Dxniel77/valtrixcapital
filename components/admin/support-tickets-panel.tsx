"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  LifeBuoy,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SupportReplyComposer } from "@/components/support/support-reply-composer";
import { SupportThreadBubble } from "@/components/support/support-thread";
import { useI18n } from "@/lib/i18n/context";
import {
  adminFetchSupportTicket,
  adminFetchSupportTickets,
  adminReplySupportTicket,
  adminUpdateSupportTicketStatus,
  ApiError,
  type SupportTicketDto,
} from "@/lib/api/client";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { ticketStatuses } from "@/lib/support/ticket-schema";
import { cn, shortenAddress } from "@/lib/utils";

const STATUS_VARIANT: Record<
  string,
  "success" | "danger" | "info" | "gold" | "warning" | "default"
> = {
  open: "warning",
  pending: "info",
  resolved: "success",
  closed: "default",
};

export function SupportTicketsPanel() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("tkt");
  const backend = useBackendAvailable();
  const [filter, setFilter] = React.useState<string>("active");
  const [tickets, setTickets] = React.useState<SupportTicketDto[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<SupportTicketDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [reply, setReply] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [notifyUser, setNotifyUser] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const statusParam =
    filter === "all"
      ? undefined
      : filter === "active"
        ? undefined
        : filter;

  async function loadTickets() {
    if (!backend) {
      setTickets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await adminFetchSupportTickets(statusParam);
      let rows = res.tickets ?? [];
      if (filter === "active") {
        rows = rows.filter((tk) => tk.status === "open" || tk.status === "pending");
      }
      setTickets(rows);
      if (deepLinkId && rows.some((tk) => tk.id === deepLinkId)) {
        setSelectedId(deepLinkId);
      } else if (selectedId && !rows.some((tk) => tk.id === selectedId)) {
        setSelectedId(null);
        setDetail(null);
      }
    } catch {
      toast.error(t("admin.support.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await adminFetchSupportTicket(id);
      setDetail(res.ticket ?? null);
    } catch {
      toast.error(t("admin.support.loadFailed"));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  React.useEffect(() => {
    void loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, filter, deepLinkId]);

  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId]);

  async function handleStatusChange(status: string) {
    if (!detail) return;
    try {
      const res = await adminUpdateSupportTicketStatus(detail.id, status);
      setDetail(res.ticket);
      setTickets((prev) =>
        prev.map((tk) => (tk.id === res.ticket.id ? res.ticket : tk)),
      );
      toast.success(t("admin.support.statusUpdated"));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t("admin.support.actionFailed"),
      );
    }
  }

  async function handleReply() {
    if (!detail || (!reply.trim() && files.length === 0)) return;

    setSubmitting(true);
    try {
      const res = await adminReplySupportTicket({
        ticketId: detail.id,
        message: reply.trim(),
        notifyUser,
        files,
      });
      setDetail(res.ticket);
      setTickets((prev) =>
        prev.map((tk) => (tk.id === res.ticket.id ? res.ticket : tk)),
      );
      setReply("");
      setFiles([]);
      toast.success(
        notifyUser
          ? t("admin.support.replySentEmail")
          : t("admin.support.replySent"),
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t("admin.support.actionFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const openCount = tickets.filter(
    (tk) => tk.status === "open" || tk.status === "pending",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "active", label: t("admin.support.filterActive") },
            { key: "all", label: t("admin.support.filterAll") },
            ...ticketStatuses.map((status) => ({
              key: status,
              label: t(`admin.support.status.${status}`),
            })),
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs transition-colors",
                filter === item.key
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-border-subtle text-text-secondary hover:bg-bg-hover",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadTickets()}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          {t("admin.support.refresh")}
        </Button>
      </div>

      {!backend ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <LifeBuoy className="h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-secondary">
              {t("admin.support.backendOffline")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card className="overflow-hidden">
            <div className="border-b border-border-subtle px-4 py-3 text-sm text-text-secondary">
              {t("admin.support.queueTitle", { n: openCount })}
            </div>
            <div className="max-h-[560px] overflow-y-auto divide-y divide-border-subtle">
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("admin.support.loading")}
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-10 text-center">
                  <MessageSquare className="h-7 w-7 text-text-muted" />
                  <p className="text-sm text-text-secondary">
                    {t("admin.support.empty")}
                  </p>
                </div>
              ) : (
                tickets.map((ticket) => {
                  const active = ticket.id === selectedId;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedId(ticket.id)}
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
                          <p className="mt-0.5 truncate text-xs text-text-muted">
                            {ticket.name} · {ticket.email}
                          </p>
                        </div>
                        <Badge variant={STATUS_VARIANT[ticket.status] ?? "default"}>
                          {t(`admin.support.status.${ticket.status}`)}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                        <span className="font-mono">{ticket.id}</span>
                        <span>
                          {t(`supportPage.categories.${ticket.category}`)}
                        </span>
                        <span>
                          {new Date(ticket.createdAt).toLocaleString("es-ES", {
                            timeZone: "UTC",
                            hour12: false,
                          })}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            {!selectedId ? (
              <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
                <LifeBuoy className="h-8 w-8 text-text-muted" />
                <p className="text-sm text-text-secondary">
                  {t("admin.support.selectTicket")}
                </p>
              </CardContent>
            ) : detailLoading || !detail ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("admin.support.loading")}
              </div>
            ) : (
              <div className="flex min-h-[560px] flex-col">
                <div className="border-b border-border-subtle p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-text-primary">
                        {detail.subject}
                      </h3>
                      <p className="mt-1 font-mono text-xs text-gold">{detail.id}</p>
                    </div>
                    <select
                      value={detail.status}
                      onChange={(e) => void handleStatusChange(e.target.value)}
                      className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-xs text-text-primary"
                    >
                      {ticketStatuses.map((status) => (
                        <option key={status} value={status}>
                          {t(`admin.support.status.${status}`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <Meta label={t("admin.support.metaName")} value={detail.name} />
                    <Meta
                      label={t("admin.support.metaEmail")}
                      value={detail.email}
                      href={`mailto:${detail.email}`}
                    />
                    {detail.wallet ? (
                      <Meta
                        label={t("admin.support.metaWallet")}
                        value={shortenAddress(detail.wallet)}
                        mono
                      />
                    ) : null}
                    <Meta
                      label={t("admin.support.metaCategory")}
                      value={t(`supportPage.categories.${detail.category}`)}
                    />
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
                          ? t("admin.support.staffReply")
                          : detail.name
                      }
                      body={item.body}
                      time={item.createdAt}
                      staff={item.isStaff}
                      attachments={item.attachments}
                    />
                  ))}
                </div>

                <SupportReplyComposer
                  value={reply}
                  onChange={setReply}
                  files={files}
                  onFilesChange={setFiles}
                  onSubmit={handleReply}
                  submitting={submitting}
                  placeholder={t("admin.support.replyPlaceholder")}
                  submitLabel={t("admin.support.sendReply")}
                  extra={
                    <label className="flex items-center gap-2 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        checked={notifyUser}
                        onChange={(e) => setNotifyUser(e.target.checked)}
                        className="rounded border-border-subtle"
                      />
                      <Mail className="h-3.5 w-3.5" />
                      {t("admin.support.notifyUser")}
                    </label>
                  }
                />
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Meta({
  label,
  value,
  href,
  mono,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-text-muted">{label}</p>
      {href ? (
        <a
          href={href}
          className={cn("text-sm text-gold hover:underline", mono && "font-mono")}
        >
          {value}
        </a>
      ) : (
        <p className={cn("text-sm text-text-primary", mono && "font-mono")}>
          {value}
        </p>
      )}
    </div>
  );
}
