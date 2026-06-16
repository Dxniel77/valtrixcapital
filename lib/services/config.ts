import { prisma } from "@/lib/db";
import { fromMicro } from "@/lib/utils";

export interface PlatformConfigDto {
  baseYieldBps: number;
  bonusPerWinBps: number;
  maxTradesPerDay: number;
  maxDailyYieldBps: number;
  withdrawalFeeBps: number;
  commissionRatesBps: number[];
  minStake: number;
  maxStake: number;
  minWithdrawal: number;
  allowedPairs: string[];
  updatedAt: string;
}

export async function getPlatformConfig(): Promise<PlatformConfigDto> {
  const config = await prisma.appConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  return {
    baseYieldBps: config.baseYieldBps,
    bonusPerWinBps: config.bonusPerWinBps,
    maxTradesPerDay: config.maxTradesPerDay,
    maxDailyYieldBps: config.maxDailyYieldBps,
    withdrawalFeeBps: config.withdrawalFeeBps,
    commissionRatesBps: config.commissionRatesBps,
    minStake: fromMicro(config.minStake),
    maxStake: fromMicro(config.maxStake),
    minWithdrawal: fromMicro(config.minWithdrawal),
    allowedPairs: config.allowedPairs,
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function updatePlatformConfig(
  patch: Partial<Omit<PlatformConfigDto, "updatedAt">>,
): Promise<PlatformConfigDto> {
  const { toMicro } = await import("@/lib/utils");

  const updated = await prisma.appConfig.update({
    where: { id: 1 },
    data: {
      baseYieldBps: patch.baseYieldBps,
      bonusPerWinBps: patch.bonusPerWinBps,
      maxTradesPerDay: patch.maxTradesPerDay,
      maxDailyYieldBps: patch.maxDailyYieldBps,
      withdrawalFeeBps: patch.withdrawalFeeBps,
      commissionRatesBps: patch.commissionRatesBps,
      minStake: patch.minStake !== undefined ? toMicro(patch.minStake) : undefined,
      maxStake: patch.maxStake !== undefined ? toMicro(patch.maxStake) : undefined,
      minWithdrawal:
        patch.minWithdrawal !== undefined
          ? toMicro(patch.minWithdrawal)
          : undefined,
      allowedPairs: patch.allowedPairs,
    },
  });

  return {
    baseYieldBps: updated.baseYieldBps,
    bonusPerWinBps: updated.bonusPerWinBps,
    maxTradesPerDay: updated.maxTradesPerDay,
    maxDailyYieldBps: updated.maxDailyYieldBps,
    withdrawalFeeBps: updated.withdrawalFeeBps,
    commissionRatesBps: updated.commissionRatesBps,
    minStake: fromMicro(updated.minStake),
    maxStake: fromMicro(updated.maxStake),
    minWithdrawal: fromMicro(updated.minWithdrawal),
    allowedPairs: updated.allowedPairs,
    updatedAt: updated.updatedAt.toISOString(),
  };
}
