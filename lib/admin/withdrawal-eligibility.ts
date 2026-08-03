import type { AdminUser } from "@/lib/admin/store";

export type WithdrawalRuleMode = "direct_sales" | "network_levels" | "either";

export interface WithdrawalRule {
  mode: WithdrawalRuleMode;
  /** Minimum direct sales volume (USDT) to unlock withdrawals. */
  directSalesMin: number;
  /** Alternative: minimum combined L1 + L2 network volume. */
  level1VolumeMin: number;
  level2VolumeMin: number;
}

export const DEFAULT_WITHDRAWAL_RULE: WithdrawalRule = {
  mode: "either",
  directSalesMin: 500,
  level1VolumeMin: 300,
  level2VolumeMin: 200,
};

export interface WithdrawalEligibilityResult {
  eligible: boolean;
  directSalesMet: boolean;
  networkLevelsMet: boolean;
  messageKey: string;
  /** When partially released by admin while still volume-locked. */
  partialAllowance?: number;
}

export function evaluateWithdrawalEligibility(
  user: Pick<
    AdminUser,
    | "accountGranted"
    | "withdrawalUnlocked"
    | "withdrawalRule"
    | "directSalesVolume"
    | "levelVolumes"
  > & { withdrawalAllowance?: number; balance?: number },
): WithdrawalEligibilityResult {
  if (!user.accountGranted) {
    return {
      eligible: true,
      directSalesMet: true,
      networkLevelsMet: true,
      messageKey: "walletPage.withdraw.eligibilityOpen",
    };
  }

  if (user.withdrawalUnlocked) {
    return {
      eligible: true,
      directSalesMet: true,
      networkLevelsMet: true,
      messageKey: "walletPage.withdraw.eligibilityUnlocked",
    };
  }

  const allowance = Math.max(0, user.withdrawalAllowance ?? 0);
  if (allowance > 0) {
    return {
      eligible: true,
      directSalesMet: false,
      networkLevelsMet: false,
      messageKey: "walletPage.withdraw.eligibilityPartial",
      partialAllowance: allowance,
    };
  }

  const rule = user.withdrawalRule;
  const directSalesMet = user.directSalesVolume >= rule.directSalesMin;
  const l1 = user.levelVolumes[0] ?? 0;
  const l2 = user.levelVolumes[1] ?? 0;
  const networkLevelsMet =
    l1 >= rule.level1VolumeMin && l2 >= rule.level2VolumeMin;

  let eligible = false;
  if (rule.mode === "direct_sales") eligible = directSalesMet;
  else if (rule.mode === "network_levels") eligible = networkLevelsMet;
  else eligible = directSalesMet || networkLevelsMet;

  return {
    eligible,
    directSalesMet,
    networkLevelsMet,
    messageKey: eligible
      ? "walletPage.withdraw.eligibilityUnlocked"
      : "walletPage.withdraw.eligibilityLocked",
  };
}

/**
 * Full volume unlock only. Admin partial release (`withdrawalAllowance`) must
 * NOT flip this — that only allows withdrawing up to the released amount.
 */
export function shouldUnlockWithdrawals(
  user: Pick<
    AdminUser,
    "withdrawalRule" | "directSalesVolume" | "levelVolumes" | "withdrawalUnlocked"
  >,
): boolean {
  if (user.withdrawalUnlocked) return true;
  return evaluateWithdrawalEligibility({
    ...user,
    accountGranted: true,
    // Ignore partial allowance — that is not a full unlock.
    withdrawalAllowance: 0,
  }).eligible;
}
