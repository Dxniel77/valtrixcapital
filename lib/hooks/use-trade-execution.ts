"use client";

import { toast } from "sonner";
import { type PairMeta } from "@/lib/market/pairs";
import {
  deriveSimultaneousLimit,
  hasReachedDailyTradeLimit,
  hasReachedSimultaneousLimit,
} from "@/lib/trade/limits";
import {
  hasOppositeOpenPosition,
  useDailySummary,
  useOpenPositions,
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
  const openPositions = useOpenPositions();
  const summary = useDailySummary();
  const stakes = useStakingStore((s) => s.stakes);
  const investedCapital = activeCapital(stakes);
  const hasCapital = investedCapital > 0;
  const simultaneous = deriveSimultaneousLimit(openPositions, investedCapital);
  const atSimultaneousLimit = hasReachedSimultaneousLimit(
    openPositions,
    investedCapital,
  );
  const atDailyLimit = hasReachedDailyTradeLimit(
    useTradeStore.getState().positions,
    investedCapital,
  );

  const canTrade =
    hasCapital &&
    summary.attemptsRemaining > 0 &&
    !atSimultaneousLimit &&
    !atDailyLimit &&
    livePrice !== null &&
    livePrice > 0;

  const canBuy =
    canTrade &&
    !hasOppositeOpenPosition(openPositions, pair.binance, "UP");
  const canSell =
    canTrade &&
    !hasOppositeOpenPosition(openPositions, pair.binance, "DOWN");

  function execute(direction: "UP" | "DOWN") {
    if (!hasCapital) {
      toast.error(t("trade.noCapital"));
      return;
    }
    if (!livePrice) {
      toast.error(t("errors.priceUnavailable"));
      return;
    }
    if (summary.attemptsRemaining <= 0 || atDailyLimit) {
      toast.error(t("errors.noAttempts"));
      return;
    }
    if (atSimultaneousLimit) {
      toast.error(
        t("errors.simultaneousLimit", {
          max: simultaneous.max,
          open: simultaneous.open,
        }),
      );
      return;
    }
    if (hasOppositeOpenPosition(openPositions, pair.binance, direction)) {
      toast.error(t("errors.hedgeBlocked"));
      return;
    }
    const pos = openPosition({
      pair: pair.binance,
      direction,
      entryPrice: livePrice,
      durationSec,
    });
    if (!pos) {
      if (hasOppositeOpenPosition(openPositions, pair.binance, direction)) {
        toast.error(t("errors.hedgeBlocked"));
      } else {
        toast.error(
          t("errors.simultaneousLimit", {
            max: simultaneous.max,
            open: simultaneous.open,
          }),
        );
      }
      return;
    }
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
    canBuy,
    canSell,
    hasCapital,
    investedCapital,
    simultaneous,
    atSimultaneousLimit,
    atDailyLimit,
    execute,
    summary,
    maxTrades: summary.maxAttempts,
  };
}
