import type { AdminUser } from "@/lib/admin/store";
import type { WithdrawalRule } from "@/lib/admin/withdrawal-eligibility";

export interface VolumeProgressItem {
  key: "direct" | "l1" | "l2";
  labelKey: string;
  current: number;
  target: number;
  remaining: number;
  pct: number;
  met: boolean;
}

export function volumeProgressPct(current: number, target: number): number {
  if (target <= 0) return 100;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

function buildProgressItem(input: {
  key: VolumeProgressItem["key"];
  labelKey: string;
  current: number;
  target: number;
}): VolumeProgressItem {
  return {
    key: input.key,
    labelKey: input.labelKey,
    current: input.current,
    target: input.target,
    remaining: Math.max(0, input.target - input.current),
    pct: volumeProgressPct(input.current, input.target),
    met: input.current >= input.target,
  };
}

export function buildVolumeProgressItems(
  volumes: { direct: number; l1: number; l2: number },
  rule: WithdrawalRule,
): VolumeProgressItem[] {
  const items: VolumeProgressItem[] = [];
  const showDirect = rule.mode === "direct_sales" || rule.mode === "either";
  const showNetwork = rule.mode === "network_levels" || rule.mode === "either";

  if (showDirect) {
    items.push(
      buildProgressItem({
        key: "direct",
        labelKey: "admin.grant.progressDirect",
        current: volumes.direct,
        target: rule.directSalesMin,
      }),
    );
  }

  if (showNetwork) {
    items.push(
      buildProgressItem({
        key: "l1",
        labelKey: "admin.grant.progressL1",
        current: volumes.l1,
        target: rule.level1VolumeMin,
      }),
      buildProgressItem({
        key: "l2",
        labelKey: "admin.grant.progressL2",
        current: volumes.l2,
        target: rule.level2VolumeMin,
      }),
    );
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

export function primaryProgressItem(
  items: VolumeProgressItem[],
): VolumeProgressItem | null {
  if (items.length === 0) return null;
  return items.find((i) => i.key === "direct") ?? items[0];
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
