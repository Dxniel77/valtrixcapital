"use client";

import { Handshake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

/** Public "IB Partner" recognition card shown on the IB's own profile. */
export function IbPartnerCard({
  isIb,
  netDepositEnabled = false,
  name,
  className,
}: {
  isIb: boolean | null | undefined;
  netDepositEnabled?: boolean;
  name?: string | null;
  className?: string;
}) {
  const { t } = useI18n();
  if (!isIb) return null;

  const displayName = name?.trim();

  return (
    <Card
      className={cn(
        "overflow-hidden border-gold/40 bg-gradient-to-r from-gold/10 via-transparent to-gold/5",
        className,
      )}
    >
      <CardContent className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:gap-8">
        <div className="flex flex-col items-center gap-2">
          <span className="relative inline-flex h-24 w-24 items-center justify-center rounded-full border-2 border-gold/70 bg-bg-elevated shadow-[0_0_24px_hsl(var(--gold)/0.25)]">
            <span className="absolute inset-1 rounded-full border border-gold/25" />
            <span className="text-gradient-gold font-display text-3xl font-bold tracking-wide">
              IB
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            <Handshake className="h-3 w-3" />
            {t("ib.partnerTitle")}
          </span>
        </div>

        <div className="flex-1 space-y-3 text-center sm:text-left">
          {displayName ? (
            <div className="inline-flex rounded-lg border border-gold/40 bg-bg-elevated px-5 py-2.5">
              <span className="text-gradient-gold font-display text-2xl font-semibold uppercase tracking-wide">
                {displayName}
              </span>
            </div>
          ) : null}
          <p className="text-sm text-text-secondary">
            {t("ib.partnerSubtitle")}
          </p>
          {netDepositEnabled ? (
            <p className="text-xs text-text-muted">
              {t("ib.partnerNetDeposit")}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
