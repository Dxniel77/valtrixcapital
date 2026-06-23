import type { PlatformConfigDto } from "@/lib/services/config";
import type { PlatformSettings } from "@/lib/platform/settings-store";
import { normalizeCommissionRatesBps } from "@/lib/referrals/constants";

type PlatformConfigInput = Omit<PlatformConfigDto, "updatedAt"> & {
  updatedAt?: string;
};

export function dtoToPlatformSettings(dto: PlatformConfigInput): PlatformSettings {
  return {
    baseYieldBps: dto.baseYieldBps,
    bonusPerWinBps: dto.bonusPerWinBps,
    maxDailyYieldBps: dto.maxDailyYieldBps,
    commissionRatesBps: normalizeCommissionRatesBps(dto.commissionRatesBps),
    withdrawalFeeBps: dto.withdrawalFeeBps,
    minWithdrawalUsdt: dto.minWithdrawal,
    minStakeUsdt: dto.minStake,
    maxStakeUsdt: dto.maxStake,
    allowedPairs: [...dto.allowedPairs],
  };
}

export function platformSettingsToPatch(
  settings: PlatformSettings,
): Partial<Omit<PlatformConfigDto, "updatedAt">> {
  return {
    baseYieldBps: settings.baseYieldBps,
    bonusPerWinBps: settings.bonusPerWinBps,
    maxDailyYieldBps: settings.maxDailyYieldBps,
    commissionRatesBps: settings.commissionRatesBps,
    withdrawalFeeBps: settings.withdrawalFeeBps,
    minWithdrawal: settings.minWithdrawalUsdt,
    minStake: settings.minStakeUsdt,
    maxStake: settings.maxStakeUsdt,
    allowedPairs: settings.allowedPairs,
  };
}
