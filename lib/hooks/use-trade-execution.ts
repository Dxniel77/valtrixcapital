"use client";

import * as React from "react";
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
import {
  openTradeWithBackend,
  tradeErrorMessage,
} from "@/lib/trade/backend-trades";
import { mapServerTradeToPosition } from "@/lib/trade/hydrate-trades";
import { activeCapital, useStakingStore } from "@/lib/staking/store";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { allowOfflineSimulation } from "@/lib/runtime-mode";
import { formatNumber } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

export function useTradeExecution(
  pair: PairMeta,
  livePrice: number | null,
  durationSec: number,
) {
  const { t } = useI18n();
  const backend = useBackendAvailable();
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
  const [submitting, setSubmitting] = React.useState(false);
  const submitLockRef = React.useRef(false);

  const canTrade =
    hasCapital &&
    summary.attemptsRemaining > 0 &&
    !atSimultaneousLimit &&
    !atDailyLimit &&
    !submitting &&
    livePrice !== null &&
    livePrice > 0;

  const canBuy =
    canTrade &&
    !hasOppositeOpenPosition(openPositions, pair.binance, "UP");
  const canSell =
    canTrade &&
    !hasOppositeOpenPosition(openPositions, pair.binance, "DOWN");

  async function execute(direction: "UP" | "DOWN") {
    if (submitLockRef.current) return;
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

    submitLockRef.current = true;
    setSubmitting(true);

    try {
      if (backend) {
        try {
          const trade = await openTradeWithBackend({
            pair: pair.binance,
            direction,
            entryPrice: livePrice,
            durationSec,
          });
          const pos = mapServerTradeToPosition(trade);
          toast.success(
            t("errors.tradeSuccess", {
              side:
                direction === "UP" ? t("common.buyArrow") : t("common.sellArrow"),
              pair: `${pair.base}/${pair.quote}`,
              price: formatNumber(pos.entryPrice, {
                decimals: pair.pricePrecision,
              }),
              duration: durationSec / 60,
            }),
          );
        } catch (err) {
          const code = tradeErrorMessage(err);
          if (code === "NO_CAPITAL") toast.error(t("trade.noCapital"));
          else if (code === "DAILY_LIMIT") toast.error(t("errors.noAttempts"));
          else if (code === "SIMULTANEOUS_LIMIT") {
            toast.error(
              t("errors.simultaneousLimit", {
                max: simultaneous.max,
                open: simultaneous.open,
              }),
            );
          } else if (code === "HEDGE_BLOCKED") toast.error(t("errors.hedgeBlocked"));
          else
            toast.error(
              err instanceof Error ? err.message : t("errors.signInFailed"),
            );
        }
        return;
      }

      if (!allowOfflineSimulation()) {
        toast.error(t("errors.backendRequired"));
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
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
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
    submitting,
    execute,
    summary,
    maxTrades: summary.maxAttempts,
  };
}
