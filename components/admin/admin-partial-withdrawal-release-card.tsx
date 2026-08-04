"use client";

import * as React from "react";
import { toast } from "sonner";
import { Unlock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";
import { formatNumber } from "@/lib/utils";
import { useAdminStore, type AdminUser } from "@/lib/admin/store";

/**
 * Admin partial release of locked sponsored earnings.
 * Example: balance 200 → release 20 → user can withdraw only 20.
 */
export function AdminPartialWithdrawalReleaseCard({ user }: { user: AdminUser }) {
  const { t } = useI18n();
  const mergeUsersFromBackend = useAdminStore((s) => s.mergeUsersFromBackend);
  const liveUser = useAdminStore(
    (s) => s.users.find((u) => u.id === user.id) ?? user,
  );
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  if (!liveUser.accountGranted || liveUser.withdrawalUnlocked) return null;

  const allowance = liveUser.withdrawalAllowance ?? 0;
  const remainingLocked = Math.max(0, liveUser.balance - allowance);

  async function release() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(t("admin.partialRelease.invalidAmount"));
      return;
    }
    if (value > remainingLocked + 1e-9) {
      toast.error(
        t("admin.partialRelease.tooMuch", {
          max: formatNumber(remainingLocked, { decimals: 2 }),
        }),
      );
      return;
    }

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
      }>(`/api/admin/users/${user.id}/release-withdrawal`, {
        method: "POST",
        body: JSON.stringify({ amount: value, note: note.trim() }),
      });
      mergeUsersFromBackend([res.user]);
      toast.success(
        t("admin.partialRelease.success", {
          amount: formatNumber(value, { decimals: 2 }),
        }),
      );
      setAmount("");
      setNote("");
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
          <Unlock className="h-4 w-4 text-gold" />
          {t("admin.partialRelease.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">{t("admin.partialRelease.hint")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label={t("admin.partialRelease.balance")}
            value={`$${formatNumber(liveUser.balance, { decimals: 2 })}`}
          />
          <Stat
            label={t("admin.partialRelease.released")}
            value={`$${formatNumber(allowance, { decimals: 2 })}`}
          />
          <Stat
            label={t("admin.partialRelease.stillLocked")}
            value={`$${formatNumber(remainingLocked, { decimals: 2 })}`}
          />
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-border-subtle pt-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.partialRelease.amount")}
            </label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-36"
              inputMode="decimal"
              placeholder="20"
            />
          </div>
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.partialRelease.note")}
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("admin.partialRelease.notePlaceholder")}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void release()}
            loading={loading}
            disabled={remainingLocked <= 0}
          >
            <Unlock className="h-4 w-4" />
            {t("admin.partialRelease.cta")}
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
