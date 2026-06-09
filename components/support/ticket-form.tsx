"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { ticketCategories } from "@/lib/support/ticket-schema";
import { cn } from "@/lib/utils";
import { useAccount } from "wagmi";

export function SupportTicketForm() {
  const { t } = useI18n();
  const { address } = useAccount();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [wallet, setWallet] = React.useState("");
  const [category, setCategory] =
    React.useState<(typeof ticketCategories)[number]>("account");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [ticketId, setTicketId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (address && !wallet) setWallet(address);
  }, [address, wallet]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          wallet: wallet.trim() || "",
          category,
          subject,
          message,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        ticket?: { id: string };
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? t("supportPage.ticketError"));
        return;
      }
      setTicketId(data.ticket?.id ?? null);
      toast.success(t("supportPage.ticketSuccess"));
      setSubject("");
      setMessage("");
    } catch {
      toast.error(t("supportPage.ticketError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (ticketId) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="p-6 text-center">
          <p className="font-medium text-text-primary">
            {t("supportPage.ticketCreated")}
          </p>
          <p className="mt-2 font-mono text-sm text-gold">{ticketId}</p>
          <p className="mt-3 text-sm text-text-secondary">
            {t("supportPage.ticketCreatedHint")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setTicketId(null)}
          >
            {t("supportPage.newTicket")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("supportPage.ticketTitle")}</CardTitle>
        <p className="text-sm text-text-secondary">{t("supportPage.ticketDesc")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("supportPage.nameLabel")} required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
              />
            </Field>
            <Field label={t("supportPage.emailLabel")} required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={120}
              />
            </Field>
          </div>

          <Field label={t("supportPage.walletLabel")}>
            <Input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x…"
              className="font-mono text-sm"
            />
          </Field>

          <Field label={t("supportPage.categoryLabel")} required>
            <div className="flex flex-wrap gap-2">
              {ticketCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs transition-colors",
                    category === cat
                      ? "border-gold/50 bg-gold/10 text-gold"
                      : "border-border-subtle text-text-secondary hover:bg-bg-hover",
                  )}
                >
                  {t(`supportPage.categories.${cat}`)}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t("supportPage.subjectLabel")} required>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={120}
            />
          </Field>

          <Field label={t("supportPage.messageLabel")} required>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={10}
              maxLength={4000}
              rows={5}
              className="w-full resize-y rounded-md border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none"
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t("supportPage.submitTicket")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs uppercase tracking-wider text-text-muted">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
    </div>
  );
}
