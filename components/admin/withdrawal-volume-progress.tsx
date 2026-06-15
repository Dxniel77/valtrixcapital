"use client";

import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import type { VolumeProgressItem } from "@/lib/admin/withdrawal-progress";
import { cn, formatNumber } from "@/lib/utils";

interface WithdrawalVolumeProgressProps {
  items: VolumeProgressItem[];
  unlocked?: boolean;
  compact?: boolean;
  title?: string;
}

export function WithdrawalVolumeProgress({
  items,
  unlocked = false,
  compact = false,
  title,
}: WithdrawalVolumeProgressProps) {
  const { t } = useI18n();

  if (items.length === 0) return null;

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {title ? (
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {title}
        </p>
      ) : null}
      {items.map((item) => (
        <VolumeBar key={item.key} item={item} compact={compact} />
      ))}
      {unlocked ? (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="h-3.5 w-3.5" />
          {t("admin.grant.progressUnlocked")}
        </p>
      ) : null}
    </div>
  );
}

function VolumeBar({
  item,
  compact,
}: {
  item: VolumeProgressItem;
  compact?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-text-secondary",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          {t(item.labelKey)}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono",
            compact ? "text-[10px]" : "text-xs",
            item.met ? "text-success" : "text-text-primary",
          )}
        >
          ${formatNumber(item.current, { decimals: 0 })}
          <span className="text-text-muted">
            {" / "}${formatNumber(item.target, { decimals: 0 })}
          </span>
        </span>
      </div>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-bg-base",
          compact ? "h-1.5" : "h-2.5",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            item.met
              ? "bg-gradient-to-r from-success to-success/80"
              : "bg-gradient-to-r from-gold via-gold-bright to-gold",
          )}
          style={{
            width: `${item.pct}%`,
            boxShadow: item.met
              ? "0 0 12px rgba(34,197,94,0.25)"
              : "0 0 16px rgba(212,175,55,0.3)",
          }}
        />
      </div>
    </div>
  );
}
