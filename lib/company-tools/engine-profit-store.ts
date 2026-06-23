"use client";

import { create } from "zustand";
import {
  BOT_CADENCE_MS,
  computeGlobalBotProfits,
} from "@/lib/bot/global-simulation";
import {
  LIQUIDATION_CADENCE_MS,
  computeGlobalLiquidationProfits,
} from "@/lib/liquidation-engine/global-simulation";
import type { LiquidationChainTx } from "@/lib/liquidation-engine/types";
import { warmEngineDailyLedgers } from "@/lib/company-tools/daily-ledger-cache";

export type BotCadence = keyof typeof BOT_CADENCE_MS;
export type LiquidationCadence = keyof typeof LIQUIDATION_CADENCE_MS;

export const ZERO_BOT_PROFITS = { today: 0, week: 0, allTime: 0 };
export const ZERO_LIQ_PROFITS = {
  today: 0,
  week: 0,
  allTime: 0,
  processedToday: 0,
};

export type BotEngineProfits = typeof ZERO_BOT_PROFITS;
export type LiquidationEngineProfits = typeof ZERO_LIQ_PROFITS;

interface EngineProfitState {
  ready: boolean;
  warming: boolean;
  botCadence: BotCadence;
  liqCadence: LiquidationCadence;
  bot: BotEngineProfits;
  liquidation: LiquidationEngineProfits;
}

interface EngineProfitActions {
  prime: () => void;
  setCadences: (botCadence: BotCadence, liqCadence: LiquidationCadence) => void;
  refresh: (txPool?: LiquidationChainTx[]) => void;
}

const warmKeyFor = (botCadence: BotCadence, liqCadence: LiquidationCadence) =>
  `${botCadence}:${liqCadence}`;

let warmPromises = new Map<string, Promise<void>>();
let tickId: number | null = null;

function ensureWarm(
  botCadence: BotCadence,
  liqCadence: LiquidationCadence,
): Promise<void> {
  const key = warmKeyFor(botCadence, liqCadence);
  const existing = warmPromises.get(key);
  if (existing) return existing;

  const promise = warmEngineDailyLedgers(
    BOT_CADENCE_MS[botCadence],
    LIQUIDATION_CADENCE_MS[liqCadence],
  ).catch(() => undefined);
  warmPromises.set(key, promise);
  return promise;
}

function startRefreshLoop(): void {
  if (tickId != null || typeof window === "undefined") return;
  tickId = window.setInterval(() => {
    void import("@/lib/liquidation-engine/store").then(({ useLiquidationStore }) => {
      const txPool = useLiquidationStore.getState().txPool;
      useEngineProfitStore.getState().refresh(txPool);
    });
  }, 3_000);
}

export const useEngineProfitStore = create<EngineProfitState & EngineProfitActions>(
  (set, get) => ({
    ready: false,
    warming: false,
    botCadence: "normal",
    liqCadence: "fast",
    bot: ZERO_BOT_PROFITS,
    liquidation: ZERO_LIQ_PROFITS,

    refresh: (txPool = []) => {
      const { botCadence, liqCadence } = get();
      const now = Date.now();
      set({
        bot: computeGlobalBotProfits(now, BOT_CADENCE_MS[botCadence]),
        liquidation: computeGlobalLiquidationProfits(
          now,
          LIQUIDATION_CADENCE_MS[liqCadence],
          txPool,
        ),
      });
    },

    prime: () => {
      const { botCadence, liqCadence, warming } = get();
      if (warming) return;
      set({ warming: true });
      startRefreshLoop();

      void ensureWarm(botCadence, liqCadence).finally(() => {
        get().refresh([]);
        set({ ready: true, warming: false });
      });
    },

    setCadences: (botCadence, liqCadence) => {
      const prev = get();
      if (prev.botCadence === botCadence && prev.liqCadence === liqCadence) return;

      set({
        botCadence,
        liqCadence,
        ready: false,
        warming: true,
        bot: ZERO_BOT_PROFITS,
        liquidation: ZERO_LIQ_PROFITS,
      });

      void ensureWarm(botCadence, liqCadence).finally(() => {
        void import("@/lib/liquidation-engine/store").then(({ useLiquidationStore }) => {
          get().refresh(useLiquidationStore.getState().txPool);
          set({ ready: true, warming: false });
        });
      });
    },
  }),
);

export function primeEngineProfitLedgers(): void {
  useEngineProfitStore.getState().prime();
}

export function syncEngineProfitCadences(
  botCadence: BotCadence,
  liqCadence: LiquidationCadence,
): void {
  useEngineProfitStore.getState().setCadences(botCadence, liqCadence);
}

export function useEngineProfitsReady(): boolean {
  return useEngineProfitStore((s) => s.ready);
}

export function useEngineBotProfits(): BotEngineProfits {
  return useEngineProfitStore((s) => s.bot);
}

export function useEngineLiquidationProfits(): LiquidationEngineProfits {
  return useEngineProfitStore((s) => s.liquidation);
}
