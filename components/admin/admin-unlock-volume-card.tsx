"use client";

import * as React from "react";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api/client";
import { formatNumber } from "@/lib/utils";
import { useAdminStore, type AdminUser } from "@/lib/admin/store";

/**
 * Admin repair: add direct-sales unlock volume for a sponsored user.
 * Does not change earnings or active capital — only the progress bar.
 */
export function AdminUnlockVolumeCard({ user }: { user: AdminUser }) {
  const { t } = useI18n();
  const mergeUsersFromBackend = useAdminStore((s) => s.mergeUsersFromBackend);
  const liveUser = useAdminStore(
    (s) => s.users.find((u) => u.id === user.id) ?? user,
  );
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  if (!liveUser.accountGranted) return null;

  async function credit() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(t("admin.unlockVolume.invalidAmount"));
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        user: AdminUser & {
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
          realCapital: number;
          companyCapital: number;
          createdAt: string;
        };
      }>(`/api/admin/users/${user.id}/unlock-volume`, {
        method: "POST",
        body: JSON.stringify({
          amount: value,
          level: "direct",
          note: note.trim(),
        }),
      });
      mergeUsersFromBackend([res.user]);
      toast.success(
        t("admin.unlockVolume.success", {
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
    <Card className="border-warning/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-warning" />
          {t("admin.unlockVolume.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">{t("admin.unlockVolume.hint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat
            label={t("admin.unlockVolume.currentDirect")}
            value={`$${formatNumber(liveUser.directSalesVolume ?? 0, { decimals: 2 })}`}
          />
          <Stat
            label={t("admin.unlockVolume.status")}
            value={
              liveUser.withdrawalUnlocked
                ? t("admin.unlockVolume.unlocked")
                : t("admin.unlockVolume.locked")
            }
          />
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-border-subtle pt-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.unlockVolume.amount")}
            </label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-36"
              inputMode="decimal"
              placeholder="525"
            />
          </div>
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.unlockVolume.note")}
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("admin.unlockVolume.notePlaceholder")}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void credit()}
            loading={loading}
          >
            <Target className="h-4 w-4" />
            {t("admin.unlockVolume.cta")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-text-primary">{value}</p>
    </div>
  );
}
