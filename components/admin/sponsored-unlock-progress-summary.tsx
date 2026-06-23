"use client";

import { Badge } from "@/components/ui/badge";
import {
  primaryProgressItem,
  progressItemsForUser,
} from "@/lib/admin/withdrawal-progress";
import type { AdminUser } from "@/lib/admin/store";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/utils";

export function SponsoredUnlockProgressSummary({
  user,
}: {
  user: Pick<
    AdminUser,
    | "accountGranted"
    | "withdrawalUnlocked"
    | "withdrawalRule"
    | "directSalesVolume"
    | "levelVolumes"
  >;
}) {
  const { t } = useI18n();

  if (!user.accountGranted) {
    return <span className="text-xs text-text-muted">—</span>;
  }

  if (user.withdrawalUnlocked) {
    return (
      <Badge variant="success" className="whitespace-nowrap text-[10px]">
        {t("admin.lookup.withdrawOk")}
      </Badge>
    );
  }

  const primary = primaryProgressItem(progressItemsForUser(user));
  if (!primary) {
    return <span className="text-xs text-text-muted">—</span>;
  }

  return (
    <div className="w-[132px] max-w-[132px] space-y-1">
      <div className="flex items-center justify-between gap-1 text-[10px] leading-none">
        <span className="truncate text-text-muted">{t(primary.labelKey)}</span>
        <span className="shrink-0 font-mono text-gold">
          {formatNumber(primary.pct, { decimals: 0 })}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-base">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright transition-[width] duration-500"
          style={{ width: `${primary.pct}%` }}
        />
      </div>
      <p className="truncate font-mono text-[10px] leading-tight text-text-secondary">
        ${formatNumber(primary.current, { decimals: 0 })}
        <span className="text-text-muted">
          {" / "}${formatNumber(primary.target, { decimals: 0 })}
        </span>
      </p>
    </div>
  );
}
