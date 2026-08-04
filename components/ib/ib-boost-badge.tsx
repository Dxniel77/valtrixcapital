"use client";

import { Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { cn, formatNumber } from "@/lib/utils";

export type IbBoostBadgeInfo = {
  name: string;
  passiveBonusBps?: number;
  tradeBonusExtraBps?: number;
};

/** Shared “IB boost active” badge for user portfolio/profile and admin views. */
export function IbBoostBadge({
  boost,
  className,
  showName = false,
  compact = false,
}: {
  boost: IbBoostBadgeInfo | null | undefined;
  className?: string;
  showName?: boolean;
  compact?: boolean;
}) {
  const { t } = useI18n();
  if (!boost) return null;

  const titleParts = [boost.name];
  if ((boost.passiveBonusBps ?? 0) > 0) {
    titleParts.push(
      `+${formatNumber((boost.passiveBonusBps ?? 0) / 100, { decimals: 2 })}%/day`,
    );
  }
  if ((boost.tradeBonusExtraBps ?? 0) > 0) {
    titleParts.push(
      `+${formatNumber((boost.tradeBonusExtraBps ?? 0) / 100, { decimals: 2 })}%/win`,
    );
  }

  return (
    <Badge
      variant="gold"
      className={cn(compact && "text-[10px]", className)}
      title={titleParts.join(" · ")}
    >
      <Gauge className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
      {showName
        ? t("ib.badgeNamed", { name: boost.name })
        : t("ib.badgeActive")}
    </Badge>
  );
}
