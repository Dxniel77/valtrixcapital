"use client";

import * as React from "react";
import { toast } from "sonner";
import { Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";
import { formatNumber } from "@/lib/utils";
import { useAdminStore, type AdminUser } from "@/lib/admin/store";

/**
 * Reconcile USDT already sent outside the app (manual treasury/SafePal pay).
 * Debits earnings + matching withdrawal allowance so the user cannot withdraw again.
 */
export function AdminManualPayoutCard({ user }: { user: AdminUser }) {
  const { t } = useI18n();
  const mergeUsersFromBackend = useAdminStore((s) => s.mergeUsersFromBackend);
  const liveUser = useAdminStore(
    (s) => s.users.find((u) => u.id === user.id) ?? user,
  );
  const allowance = Math.max(0, liveUser.withdrawalAllowance ?? 0);
  const suggested =
    allowance > 0 ? allowance : liveUser.balance > 0 ? liveUser.balance : 0;

  const [amount, setAmount] = React.useState(() =>
    suggested > 0 ? String(suggested) : "",
  );
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const next =
      allowance > 0 ? allowance : liveUser.balance > 0 ? liveUser.balance : 0;
    setAmount(next > 0 ? String(next) : "");
  }, [liveUser.id, liveUser.balance, allowance]);

  if (liveUser.balance <= 0) return null;

  async function reconcile() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(t("admin.manualPayout.invalidAmount"));
      return;
    }
    if (value > liveUser.balance + 1e-9) {
      toast.error(
        t("admin.manualPayout.tooMuch", {
          max: formatNumber(liveUser.balance, { decimals: 2 }),
        }),
      );
      return;
    }

    const ok = window.confirm(
      t("admin.manualPayout.confirm", {
        amount: formatNumber(value, { decimals: 2 }),
      }),
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        user: {
          id: string;
          walletAddress: string;
          username: string | null;
          earningsBalance: number;
          lockedCapital: number;
          totalEarned: number;
          isActive: boolean;
          role: "USER" | "ADMIN";
          registrationSource: "referral" | "direct";
          referrerWallet: string | null;
          referrerUsername: string | null;
          directReferrals: number;
          accountGranted: boolean;
          withdrawalUnlocked: boolean;
          withdrawalAllowance?: number;
          withdrawalRule: AdminUser["withdrawalRule"] | null;
          realCapital: number;
          companyCapital: number;
          directSalesVolume: number;
          levelVolumes: number[];
          createdAt: string;
        };
      }>(`/api/admin/users/${user.id}/manual-payout`, {
        method: "POST",
        body: JSON.stringify({ amount: value, note: note.trim() }),
      });
      mergeUsersFromBackend([res.user]);
      toast.success(
        t("admin.manualPayout.success", {
          amount: formatNumber(value, { decimals: 2 }),
        }),
      );
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-warning/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote className="h-4 w-4 text-warning" />
          {t("admin.manualPayout.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">{t("admin.manualPayout.hint")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label={t("admin.manualPayout.balance")}
            value={`$${formatNumber(liveUser.balance, { decimals: 2 })}`}
          />
          <Stat
            label={t("admin.manualPayout.released")}
            value={`$${formatNumber(allowance, { decimals: 2 })}`}
          />
          <Stat
            label={t("admin.manualPayout.max")}
            value={`$${formatNumber(liveUser.balance, { decimals: 2 })}`}
          />
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-border-subtle pt-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.manualPayout.amount")}
            </label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-36"
              inputMode="decimal"
              placeholder="119"
            />
          </div>
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.manualPayout.note")}
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("admin.manualPayout.notePlaceholder")}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void reconcile()}
            loading={loading}
          >
            <Banknote className="h-4 w-4" />
            {t("admin.manualPayout.cta")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}
