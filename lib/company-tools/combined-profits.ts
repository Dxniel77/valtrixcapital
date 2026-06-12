"use client";

import * as React from "react";
import { useCompanyProfits } from "@/lib/bot/store";
import {
  useLiquidationProfits,
  useLiquidationStore,
  utcDateKey,
} from "@/lib/liquidation-engine/store";
import { useCountUp } from "@/lib/hooks/use-count-up";

export interface CombinedEngineProfits {
  botToday: number;
  botWeek: number;
  botAllTime: number;
  liquidationToday: number;
  liquidationWeek: number;
  liquidationAllTime: number;
  /** Credited + live micro-accrual (display only). */
  liquidationTodayLive: number;
  combinedToday: number;
  combinedWeek: number;
  combinedAllTime: number;
  combinedTodayLive: number;
}

export function useCombinedEngineProfits(): CombinedEngineProfits {
  const bot = useCompanyProfits();
  const liquidation = useLiquidationProfits();
  const microToday = useLiquidationStore((s) => s.microAccrualToday);

  return React.useMemo(() => {
    const liquidationTodayLive = liquidation.today + microToday;
    return {
      botToday: bot.today,
      botWeek: bot.week,
      botAllTime: bot.allTime,
      liquidationToday: liquidation.today,
      liquidationWeek: liquidation.week,
      liquidationAllTime: liquidation.allTime,
      liquidationTodayLive,
      combinedToday: bot.today + liquidation.today,
      combinedWeek: bot.week + liquidation.week,
      combinedAllTime: bot.allTime + liquidation.allTime,
      combinedTodayLive: bot.today + liquidationTodayLive,
    };
  }, [bot, liquidation, microToday]);
}

export function useLiveLiquidationToday(): number {
  const liquidation = useLiquidationProfits();
  const microToday = useLiquidationStore((s) => s.microAccrualToday);
  return useCountUp(liquidation.today + microToday, 2);
}

export function useLiveCombinedToday(): number {
  const combined = useCombinedEngineProfits();
  return useCountUp(combined.combinedTodayLive, 0);
}

export function useActivePairsToday(): string[] {
  const events = useLiquidationStore((s) => s.events);
  const today = utcDateKey();

  return React.useMemo(() => {
    const pairs = new Set<string>();
    for (const ev of events) {
      if (utcDateKey(ev.executedAt) === today) pairs.add(ev.pair);
    }
    return [...pairs];
  }, [events, today]);
}
