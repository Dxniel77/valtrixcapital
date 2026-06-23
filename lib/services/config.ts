import { prisma } from "@/lib/db";
import { normalizeCommissionRatesBps } from "@/lib/referrals/constants";
import { fromMicro } from "@/lib/utils";

async function resolveCommissionRates(rates: number[]): Promise<number[]> {
  const next = normalizeCommissionRatesBps(rates);
  const changed =
    next.length !== rates.length || next.some((v, i) => v !== rates[i]);
  if (changed) {
    await prisma.appConfig.update({
      where: { id: 1 },
      data: { commissionRatesBps: next },
    });
  }
  return next;
}

function normalizeConfigPatch(
  patch: Partial<Omit<PlatformConfigDto, "updatedAt">>,
): Partial<Omit<PlatformConfigDto, "updatedAt">> {
  if (!patch.commissionRatesBps) return patch;
  return {
    ...patch,
    commissionRatesBps: normalizeCommissionRatesBps(patch.commissionRatesBps),
  };
}

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

  const commissionRatesBps = await resolveCommissionRates(config.commissionRatesBps);

  return {
    baseYieldBps: config.baseYieldBps,
    bonusPerWinBps: config.bonusPerWinBps,
    maxTradesPerDay: config.maxTradesPerDay,
    maxDailyYieldBps: config.maxDailyYieldBps,
    withdrawalFeeBps: config.withdrawalFeeBps,
    commissionRatesBps,
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
  const normalizedPatch = normalizeConfigPatch(patch);

  const updated = await prisma.appConfig.update({
    where: { id: 1 },
    data: {
      baseYieldBps: normalizedPatch.baseYieldBps,
      bonusPerWinBps: normalizedPatch.bonusPerWinBps,
      maxTradesPerDay: normalizedPatch.maxTradesPerDay,
      maxDailyYieldBps: normalizedPatch.maxDailyYieldBps,
      withdrawalFeeBps: normalizedPatch.withdrawalFeeBps,
      commissionRatesBps: normalizedPatch.commissionRatesBps,
      minStake: normalizedPatch.minStake !== undefined ? toMicro(normalizedPatch.minStake) : undefined,
      maxStake: normalizedPatch.maxStake !== undefined ? toMicro(normalizedPatch.maxStake) : undefined,
      minWithdrawal:
        normalizedPatch.minWithdrawal !== undefined
          ? toMicro(normalizedPatch.minWithdrawal)
          : undefined,
      allowedPairs: normalizedPatch.allowedPairs,
    },
  });

  const commissionRatesBps = await resolveCommissionRates(
    updated.commissionRatesBps,
  );

  return {
    baseYieldBps: updated.baseYieldBps,
    bonusPerWinBps: updated.bonusPerWinBps,
    maxTradesPerDay: updated.maxTradesPerDay,
    maxDailyYieldBps: updated.maxDailyYieldBps,
    withdrawalFeeBps: updated.withdrawalFeeBps,
    commissionRatesBps,
    minStake: fromMicro(updated.minStake),
    maxStake: fromMicro(updated.maxStake),
    minWithdrawal: fromMicro(updated.minWithdrawal),
    allowedPairs: updated.allowedPairs,
    updatedAt: updated.updatedAt.toISOString(),
  };
}
