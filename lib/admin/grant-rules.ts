import {
  DEFAULT_WITHDRAWAL_RULE,
  type WithdrawalRule,
  type WithdrawalRuleMode,
} from "@/lib/admin/withdrawal-eligibility";

const MODES: WithdrawalRuleMode[] = [
  "direct_sales",
  "network_levels",
  "either",
];

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function parseWithdrawalRuleJson(value: unknown): WithdrawalRule {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_WITHDRAWAL_RULE };
  }
  const o = value as Record<string, unknown>;
  const mode = MODES.includes(o.mode as WithdrawalRuleMode)
    ? (o.mode as WithdrawalRuleMode)
    : DEFAULT_WITHDRAWAL_RULE.mode;
  return {
    mode,
    directSalesMin: num(o.directSalesMin, DEFAULT_WITHDRAWAL_RULE.directSalesMin),
    level1VolumeMin: num(
      o.level1VolumeMin,
      DEFAULT_WITHDRAWAL_RULE.level1VolumeMin,
    ),
    level2VolumeMin: num(
      o.level2VolumeMin,
      DEFAULT_WITHDRAWAL_RULE.level2VolumeMin,
    ),
  };
}

export function withdrawalRuleToJson(rule: WithdrawalRule): WithdrawalRule {
  return {
    mode: rule.mode,
    directSalesMin: rule.directSalesMin,
    level1VolumeMin: rule.level1VolumeMin,
    level2VolumeMin: rule.level2VolumeMin,
  };
}
