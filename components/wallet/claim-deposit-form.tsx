"use client";

import { useI18n } from "@/lib/i18n/context";
import { useStakingStore } from "@/lib/staking/store";

export function PendingDepositBanner() {
  const { t } = useI18n();
  const pending = useStakingStore((s) => s.pendingDeposit);

  if (!pending) return null;

  const networkLabel = pending.network === "POLYGON" ? "Polygon" : "BSC";

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gold">{t("walletPage.deposit.pendingTitle")}</p>
        <p className="mt-1 text-text-secondary">
          {t("walletPage.deposit.pendingDesc", {
            amount: pending.amount.toFixed(2),
            network: networkLabel,
            current: pending.confirmations,
            required: pending.requiredConfirmations,
          })}
        </p>
      </div>
    </div>
  );
}
