"use client";

import { toast } from "sonner";
import { type PairMeta } from "@/lib/market/pairs";
import {
  MAX_TRADES_PER_DAY,
  useDailySummary,
  useTradeStore,
} from "@/lib/trade/store";
import { activeCapital, useStakingStore } from "@/lib/staking/store";
import { formatNumber } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

export function useTradeExecution(
  pair: PairMeta,
  livePrice: number | null,
  durationSec: number,
) {
  const { t } = useI18n();
  const openPosition = useTradeStore((s) => s.openPosition);
  const summary = useDailySummary();
  const stakes = useStakingStore((s) => s.stakes);
  const investedCapital = activeCapital(stakes);
  const hasCapital = investedCapital > 0;

  const canTrade =
    hasCapital &&
    summary.attemptsRemaining > 0 &&
    livePrice !== null &&
    livePrice > 0;

  function execute(direction: "UP" | "DOWN") {
    if (!hasCapital) {
      toast.error(t("trade.noCapital"));
      return;
    }
    if (!livePrice) {
      toast.error(t("errors.priceUnavailable"));
      return;
    }
    if (summary.attemptsRemaining <= 0) {
      toast.error(t("errors.noAttempts"));
      return;
    }
    const pos = openPosition({
      pair: pair.binance,
      direction,
      entryPrice: livePrice,
      durationSec,
    });
    toast.success(
      t("errors.tradeSuccess", {
        side:
          direction === "UP" ? t("common.buyArrow") : t("common.sellArrow"),
        pair: `${pair.base}/${pair.quote}`,
        price: formatNumber(pos.entryPrice, { decimals: pair.pricePrecision }),
        duration: durationSec / 60,
      }),
    );
  }

  return {
    canTrade,
    hasCapital,
    investedCapital,
    execute,
    summary,
    maxTrades: MAX_TRADES_PER_DAY,
  };
}
