"use client";

import { AlertTriangle } from "lucide-react";
import { useDailySummary } from "@/lib/trade/store";
import { useI18n } from "@/lib/i18n/context";

export function TradeYieldSummary() {
  const { t } = useI18n();
  const summary = useDailySummary();

  return (
    <div className="surface-card space-y-3 p-5">
      <h3 className="text-sm font-semibold text-text-primary">
        {t("trade.yieldSummary")}
      </h3>
      <div className="rounded-md border border-border-subtle bg-bg-base/60 p-3 text-xs">
        <div className="flex justify-between py-0.5 text-text-secondary">
          <span>{t("trade.baseYield")}</span>
          <span className="font-mono text-text-primary">
            {(summary.baseRateBps / 100).toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between py-0.5 text-text-secondary">
          <span>{t("trade.bonusWins")}</span>
          <span className="font-mono text-gold">
            +{(summary.bonusRateBps / 100).toFixed(2)}%
          </span>
        </div>
        <div className="mt-1.5 flex justify-between border-t border-border-subtle pt-1.5 text-text-primary">
          <span className="font-medium">{t("trade.totalDaily")}</span>
          <span className="font-mono">
            {(summary.totalRateBps / 100).toFixed(2)}%
          </span>
        </div>
      </div>

      {summary.attemptsRemaining === 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t("trade.noAttemptsLeft", { max: summary.maxAttempts })}</span>
        </div>
      ) : null}
    </div>
  );
}
