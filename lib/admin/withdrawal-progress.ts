import type { AdminUser } from "@/lib/admin/store";
import type { WithdrawalRule } from "@/lib/admin/withdrawal-eligibility";

export interface VolumeProgressItem {
  key: "direct" | "l1" | "l2";
  labelKey: string;
  current: number;
  target: number;
  pct: number;
  met: boolean;
}

export function volumeProgressPct(current: number, target: number): number {
  if (target <= 0) return 100;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

export function buildVolumeProgressItems(
  volumes: { direct: number; l1: number; l2: number },
  rule: WithdrawalRule,
): VolumeProgressItem[] {
  const items: VolumeProgressItem[] = [];
  const showDirect = rule.mode === "direct_sales" || rule.mode === "either";
  const showNetwork = rule.mode === "network_levels" || rule.mode === "either";

  if (showDirect) {
    items.push({
      key: "direct",
      labelKey: "admin.grant.progressDirect",
      current: volumes.direct,
      target: rule.directSalesMin,
      pct: volumeProgressPct(volumes.direct, rule.directSalesMin),
      met: volumes.direct >= rule.directSalesMin,
    });
  }

  if (showNetwork) {
    items.push({
      key: "l1",
      labelKey: "admin.grant.progressL1",
      current: volumes.l1,
      target: rule.level1VolumeMin,
      pct: volumeProgressPct(volumes.l1, rule.level1VolumeMin),
      met: volumes.l1 >= rule.level1VolumeMin,
    });
    items.push({
      key: "l2",
      labelKey: "admin.grant.progressL2",
      current: volumes.l2,
      target: rule.level2VolumeMin,
      pct: volumeProgressPct(volumes.l2, rule.level2VolumeMin),
      met: volumes.l2 >= rule.level2VolumeMin,
    });
  }

  return items;
}

export function volumesFromAdminUser(
  user: Pick<AdminUser, "directSalesVolume" | "levelVolumes">,
) {
  return {
    direct: user.directSalesVolume,
    l1: user.levelVolumes[0] ?? 0,
    l2: user.levelVolumes[1] ?? 0,
  };
}

export function progressItemsForUser(
  user: Pick<
    AdminUser,
    | "withdrawalRule"
    | "directSalesVolume"
    | "levelVolumes"
    | "withdrawalUnlocked"
    | "accountGranted"
  >,
): VolumeProgressItem[] {
  if (!user.accountGranted) return [];
  return buildVolumeProgressItems(volumesFromAdminUser(user), user.withdrawalRule);
}
