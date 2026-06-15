import { getPlatformSettings } from "@/lib/platform/settings-store";
import { REFERRAL_LEVELS } from "./constants";
import type { DownlineMember, ReferralLevelStats } from "./store";

function rateBpsForLevel(level: number): number {
  const rates = getPlatformSettings().commissionRatesBps;
  const idx = level - 1;
  if (idx < 0 || idx >= rates.length) return 0;
  return rates[idx] ?? 0;
}

export function commissionFromYield(yieldAmount: number, level: number): number {
  const idx = level - 1;
  if (idx < 0 || idx >= REFERRAL_LEVELS) return 0;
  return (yieldAmount * rateBpsForLevel(level)) / 10_000;
}

/** Simulate each active downline member's daily yield (0.3%–1% of capital). */
export function simulateDownlineDailyYield(capital: number, seed: number): number {
  const rateBps = 30 + (seed % 8) * 10; // 0.3% .. 1.0%
  return (capital * Math.min(rateBps, 100)) / 10_000;
}

export function buildLevelStats(
  members: DownlineMember[],
): ReferralLevelStats[] {
  const stats: ReferralLevelStats[] = [];
  for (let level = 1; level <= REFERRAL_LEVELS; level += 1) {
    const atLevel = members.filter((m) => m.level === level);
    const active = atLevel.filter((m) => m.isActive);
    stats.push({
      level,
      rateBps: rateBpsForLevel(level),
      total: atLevel.length,
      active: active.length,
      earned: atLevel.reduce((s, m) => s + m.commissionsPaidToYou, 0),
    });
  }
  return stats;
}
