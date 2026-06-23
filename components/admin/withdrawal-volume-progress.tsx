"use client";

import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import type { VolumeProgressItem } from "@/lib/admin/withdrawal-progress";
import { cn, formatNumber } from "@/lib/utils";

interface WithdrawalVolumeProgressProps {
  items: VolumeProgressItem[];
  unlocked?: boolean;
  compact?: boolean;
  detailed?: boolean;
  title?: string;
}

export function WithdrawalVolumeProgress({
  items,
  unlocked = false,
  compact = false,
  detailed = false,
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
        <VolumeBar
          key={item.key}
          item={item}
          compact={compact}
          detailed={detailed}
        />
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
  detailed,
}: {
  item: VolumeProgressItem;
  compact?: boolean;
  detailed?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-medium text-text-secondary",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          {t(item.labelKey)}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono",
            compact ? "text-[10px]" : "text-xs",
            item.met ? "text-success" : "text-gold",
          )}
        >
          {formatNumber(item.pct, { decimals: 0 })}%
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

      {detailed ? (
        <div
          className={cn(
            "grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border-subtle/80 bg-bg-base/40 p-2.5",
            compact && "gap-y-0.5 p-2",
          )}
        >
          <Stat
            label={t("admin.grant.progressGoal")}
            value={`$${formatNumber(item.target, { decimals: 0 })}`}
            compact={compact}
          />
          <Stat
            label={t("admin.grant.progressEarned")}
            value={`$${formatNumber(item.current, { decimals: 0 })}`}
            compact={compact}
            highlight={item.current > 0}
          />
          <Stat
            label={t("admin.grant.progressRemaining")}
            value={`$${formatNumber(item.remaining, { decimals: 0 })}`}
            compact={compact}
          />
          <Stat
            label={t("admin.grant.progressPct")}
            value={`${formatNumber(item.pct, { decimals: 0 })}%`}
            compact={compact}
            highlight
          />
        </div>
      ) : (
        <div className="flex justify-end">
          <span
            className={cn(
              "font-mono text-text-muted",
              compact ? "text-[10px]" : "text-xs",
            )}
          >
            ${formatNumber(item.current, { decimals: 0 })}
            <span className="text-text-muted/80">
              {" / "}${formatNumber(item.target, { decimals: 0 })}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  compact,
  highlight,
}: {
  label: string;
  value: string;
  compact?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          "uppercase tracking-wider text-text-muted",
          compact ? "text-[9px]" : "text-[10px]",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "font-mono font-medium",
          compact ? "text-xs" : "text-sm",
          highlight ? "text-gold" : "text-text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}
