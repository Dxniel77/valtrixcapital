"use client";

import { Handshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

/** Marks a user as Introducing Broker (admin monitor / user list). */
export function IbStatusBadge({
  isIb,
  className,
  compact = false,
}: {
  isIb: boolean | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  if (!isIb) return null;

  return (
    <Badge
      variant="gold"
      className={cn(compact && "text-[10px]", className)}
      title={t("ib.badgeIb")}
    >
      <Handshake className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
      {t("ib.badgeIb")}
    </Badge>
  );
}
