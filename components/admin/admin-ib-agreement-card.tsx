"use client";

import * as React from "react";
import { toast } from "sonner";
import { Handshake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";
import { useAdminStore, type AdminUser } from "@/lib/admin/store";

interface Agreement {
  id: string;
  isIb: boolean;
  netDepositEnabled: boolean;
  level1DepositBps: number;
  level2DepositBps: number;
  includeLevel2: boolean;
  notes: string;
  totalCredited: number;
  creditCount: number;
}

export function AdminIbAgreementCard({ user }: { user: AdminUser }) {
  const { t } = useI18n();
  const [isIb, setIsIb] = React.useState(user.isIb ?? false);
  const [netOn, setNetOn] = React.useState(false);
  const [includeL2, setIncludeL2] = React.useState(false);
  const [l1Pct, setL1Pct] = React.useState("3");
  const [l2Pct, setL2Pct] = React.useState("2");
  const [notes, setNotes] = React.useState("");
  const [summary, setSummary] = React.useState<Agreement | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [booting, setBooting] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiFetch<{ ok: boolean; agreement: Agreement | null }>(
          `/api/admin/users/${user.id}/ib-agreement`,
        );
        if (cancelled) return;
        const a = res.agreement;
        setSummary(a);
        if (a) {
          setIsIb(a.isIb);
          setNetOn(a.netDepositEnabled);
          setIncludeL2(a.includeLevel2);
          setL1Pct(String(a.level1DepositBps / 100));
          setL2Pct(String(a.level2DepositBps / 100));
          setNotes(a.notes ?? "");
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  async function save() {
    setLoading(true);
    try {
      const res = await apiFetch<{ ok: boolean; agreement: Agreement }>(
        `/api/admin/users/${user.id}/ib-agreement`,
        {
          method: "POST",
          body: JSON.stringify({
            isIb,
            netDepositEnabled: netOn,
            includeLevel2: includeL2,
            level1DepositBps: Math.round((Number(l1Pct) || 0) * 100),
            level2DepositBps: includeL2
              ? Math.round((Number(l2Pct) || 0) * 100)
              : 0,
            notes,
          }),
        },
      );
      const a = res.agreement;
      setSummary(a);
      useAdminStore.setState((s) => ({
        users: s.users.map((u) =>
          u.id === user.id
            ? {
                ...u,
                isIb: a.isIb,
                ibNetDeposit: a.isIb
                  ? {
                      enabled: a.netDepositEnabled,
                      level1DepositBps: a.level1DepositBps,
                      level2DepositBps: a.level2DepositBps,
                      notes: a.notes,
                    }
                  : null,
              }
            : u,
        ),
      }));
      toast.success(t("admin.ib.agreementSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-gold/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Handshake className="h-4 w-4 text-gold" />
          {t("admin.ib.agreementTitle")}
          {summary?.isIb ? <Badge variant="gold">IB</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-text-secondary">{t("admin.ib.agreementHint")}</p>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isIb}
            disabled={booting || loading}
            onChange={(e) => setIsIb(e.target.checked)}
          />
          {t("admin.ib.markAsIb")}
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={netOn}
            disabled={booting || loading || !isIb}
            onChange={(e) => setNetOn(e.target.checked)}
          />
          {t("admin.ib.enableNetDeposit")}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs uppercase text-text-muted">
              {t("admin.ib.l1Pct")}
            </label>
            <Input
              value={l1Pct}
              disabled={!netOn || loading}
              onChange={(e) => setL1Pct(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase text-text-muted">
              {t("admin.ib.l2Pct")}
            </label>
            <Input
              value={l2Pct}
              disabled={!netOn || !includeL2 || loading}
              onChange={(e) => setL2Pct(e.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeL2}
            disabled={!netOn || loading}
            onChange={(e) => setIncludeL2(e.target.checked)}
          />
          {t("admin.ib.includeL2")}
        </label>

        <div className="space-y-1">
          <label className="text-xs uppercase text-text-muted">
            {t("admin.ib.notes")}
          </label>
          <Input
            value={notes}
            disabled={loading}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("admin.ib.notesPlaceholder")}
          />
        </div>

        {summary ? (
          <p className="font-mono text-xs text-text-muted">
            {t("admin.ib.creditedSoFar", {
              amount: summary.totalCredited.toFixed(2),
              n: String(summary.creditCount),
            })}
          </p>
        ) : null}

        <Button
          variant="primary"
          size="sm"
          loading={loading}
          disabled={booting}
          onClick={() => void save()}
        >
          {t("admin.ib.saveAgreement")}
        </Button>
      </CardContent>
    </Card>
  );
}
