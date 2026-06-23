"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PAIRS } from "@/lib/market/pairs";
import {
  BASE_YIELD_BPS,
  BONUS_PER_WIN_BPS,
  MAX_DAILY_YIELD_BPS,
} from "@/lib/trade/constants";
import { COMMISSION_RATES_BPS, normalizeCommissionRatesBps } from "@/lib/referrals/constants";
import {
  MIN_WITHDRAWAL_USDT,
  WITHDRAWAL_FEE_BPS,
} from "@/lib/wallet/constants";
import { STAKE_MAX_USDT, STAKE_MIN_USDT } from "@/lib/staking/constants";

export interface PlatformSettings {
  baseYieldBps: number;
  bonusPerWinBps: number;
  maxDailyYieldBps: number;
  commissionRatesBps: number[];
  withdrawalFeeBps: number;
  minWithdrawalUsdt: number;
  minStakeUsdt: number;
  maxStakeUsdt: number;
  allowedPairs: string[];
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  baseYieldBps: BASE_YIELD_BPS,
  bonusPerWinBps: BONUS_PER_WIN_BPS,
  maxDailyYieldBps: MAX_DAILY_YIELD_BPS,
  commissionRatesBps: [...COMMISSION_RATES_BPS],
  withdrawalFeeBps: WITHDRAWAL_FEE_BPS,
  minWithdrawalUsdt: MIN_WITHDRAWAL_USDT,
  minStakeUsdt: STAKE_MIN_USDT,
  maxStakeUsdt: STAKE_MAX_USDT,
  allowedPairs: PAIRS.map((p) => p.binance),
};

interface PlatformSettingsState {
  settings: PlatformSettings;
  updateSettings: (patch: Partial<PlatformSettings>) => void;
  resetSettings: () => void;
}

function importLegacyAdminSettings(): Partial<PlatformSettings> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("valtrix.admin.v3");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { settings?: Partial<PlatformSettings> } };
    return parsed.state?.settings ?? null;
  } catch {
    return null;
  }
}

export const usePlatformSettingsStore = create<PlatformSettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_PLATFORM_SETTINGS,

      updateSettings: (patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            ...patch,
            ...(patch.commissionRatesBps
              ? {
                  commissionRatesBps: normalizeCommissionRatesBps(
                    patch.commissionRatesBps,
                  ),
                }
              : {}),
          },
        })),

      resetSettings: () => set({ settings: DEFAULT_PLATFORM_SETTINGS }),
    }),
    {
      name: "valtrix.platform.settings.v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : window.localStorage,
      ),
      partialize: (s) => ({ settings: s.settings }),
      onRehydrateStorage: () => (state) => {
        if (!state || typeof window === "undefined") return;
        const normalized = normalizeCommissionRatesBps(
          state.settings.commissionRatesBps,
        );
        const ratesChanged =
          normalized.length !== state.settings.commissionRatesBps.length ||
          normalized.some(
            (v, i) => v !== state.settings.commissionRatesBps[i],
          );
        if (ratesChanged) {
          state.settings.commissionRatesBps = normalized;
        }
        if (window.localStorage.getItem("valtrix.platform.settings.v1")) {
          return;
        }
        const legacy = importLegacyAdminSettings();
        if (!legacy) return;
        state.settings = {
          ...DEFAULT_PLATFORM_SETTINGS,
          ...legacy,
          commissionRatesBps: normalizeCommissionRatesBps(
            legacy.commissionRatesBps ?? DEFAULT_PLATFORM_SETTINGS.commissionRatesBps,
          ),
        };
      },
    },
  ),
);

/** Sync read for store actions and pure helpers (non-React). */
export function getPlatformSettings(): PlatformSettings {
  return usePlatformSettingsStore.getState().settings;
}

export function usePlatformSettings(): PlatformSettings {
  return usePlatformSettingsStore((s) => s.settings);
}

export function usePlatformSettingsHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const unsub = usePlatformSettingsStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (usePlatformSettingsStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}
