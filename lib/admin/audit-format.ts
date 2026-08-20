import { shortenHash } from "@/lib/utils";

export function adjustmentTargetLabel(target?: unknown): string | null {
  if (target === "COPY") return "copy cash";
  if (target === "STAKING") return "staking";
  if (target === "WITHDRAWABLE") return "withdrawable";
  return typeof target === "string" && target.trim() ? target.trim() : null;
}

export function formatAdjustmentNote(payload: {
  note?: unknown;
  target?: unknown;
}): string | undefined {
  const pocket = adjustmentTargetLabel(payload.target);
  const note =
    typeof payload.note === "string" && payload.note.trim()
      ? payload.note.trim()
      : null;
  const parts = [pocket, note].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Maps DB admin action + payload to a display label key under admin.actions.* */
export function auditActionLabel(
  action: string,
  payload: Record<string, unknown> | null,
): string {
  if (action === "APPROVE_WITHDRAWAL" && payload?.automatic === true) {
    return "WITHDRAWAL_AUTO_PAID";
  }

  if (action === "ADJUST_BALANCE" && payload?.manualPayout === true) {
    return "MANUAL_PAYOUT_RECONCILED";
  }

  if (action === "ADJUST_BALANCE" && payload?.target === "COPY") {
    return "COPY_BALANCE_ADJUSTED";
  }

  if (action === "PROCESS_ACCOUNT_DELETION") {
    const sub = payload?.action;
    if (sub === "profile_update") return "USER_PROFILE_UPDATED";
    if (sub === "admin_direct_delete") return "ACCOUNT_DELETED";
    if (sub === "completed") return "ACCOUNT_DELETION_APPROVED";
    if (sub === "cancelled") return "ACCOUNT_DELETION_CANCELLED";
    return "ACCOUNT_DELETION_PROCESSED";
  }

  switch (action) {
    case "ACTIVATE":
      return "USER_ACTIVATED";
    case "DEACTIVATE":
      return "USER_DEACTIVATED";
    case "ADJUST_BALANCE":
      return "BALANCE_ADJUSTED";
    case "RELEASE_WITHDRAWAL_ALLOWANCE":
      return "WITHDRAWAL_ALLOWANCE_RELEASED";
    case "APPROVE_WITHDRAWAL":
      return "WITHDRAWAL_APPROVED";
    case "REJECT_WITHDRAWAL":
      return "WITHDRAWAL_REJECTED";
    case "UPDATE_CONFIG":
      return "SETTINGS_UPDATED";
    case "UPDATE_USER_PROFILE":
      return "USER_PROFILE_UPDATED";
    case "UPDATE_SPONSORSHIP":
      return "SPONSORSHIP_UPDATED";
    case "UPDATE_SPONSOR_TERMS":
      return "SPONSOR_TERMS_UPDATED";
    case "CREATE_IB_STRATEGY":
      return "IB_STRATEGY_CREATED";
    case "UPDATE_IB_STRATEGY":
      return "IB_STRATEGY_UPDATED";
    case "ASSIGN_IB_STRATEGY":
      return "IB_STRATEGY_ASSIGNED";
    case "UPSERT_IB_AGREEMENT":
      return "IB_AGREEMENT_UPDATED";
    case "IB_NET_DEPOSIT_CREDIT":
      return "IB_NET_DEPOSIT_CREDITED";
    default:
      return action;
  }
}

export function formatAuditPayload(
  action: string,
  payload: Record<string, unknown> | null,
): string {
  if (!payload) return "";

  if (action === "ADJUST_BALANCE") {
    if (payload.manualPayout === true) {
      const amount =
        payload.delta != null ? Math.abs(Number(payload.delta)) : null;
      const note =
        typeof payload.note === "string" && payload.note.trim()
          ? payload.note.trim()
          : null;
      return [
        amount != null && Number.isFinite(amount) ? `−${amount} USDT` : null,
        "manual payout",
        note,
      ]
        .filter(Boolean)
        .join(" · ");
    }

    const delta = typeof payload.delta === "number" ? payload.delta : null;
    const amount =
      delta != null && Number.isFinite(delta)
        ? `${delta >= 0 ? "+" : ""}${delta} USDT`
        : null;
    const pocket = adjustmentTargetLabel(payload.target);
    const note =
      typeof payload.note === "string" && payload.note.trim()
        ? payload.note.trim()
        : null;
    return [amount, pocket, note].filter(Boolean).join(" · ");
  }

  if (action === "UPDATE_USER_PROFILE") {
    const parts: string[] = [];
    if (typeof payload.username === "string" && payload.username.trim()) {
      parts.push(`username: ${payload.username.trim()}`);
    }
    if (payload.email !== undefined) {
      const email =
        typeof payload.email === "string" && payload.email.trim()
          ? payload.email.trim()
          : "—";
      parts.push(`email: ${email}`);
    }
    if (payload.avatarUrl !== undefined) {
      const url =
        typeof payload.avatarUrl === "string" && payload.avatarUrl.trim()
          ? payload.avatarUrl.trim()
          : "cleared";
      parts.push(`avatar: ${url}`);
    }
    return parts.join(" · ") || "profile updated";
  }

  if (action === "PROCESS_ACCOUNT_DELETION") {
    const sub = payload.action;
    if (sub === "profile_update") {
      const username =
        typeof payload.username === "string" ? payload.username.trim() : "";
      return username ? `username: ${username}` : "profile updated";
    }
    if (sub === "admin_direct_delete") return "account deactivated by admin";
    if (sub === "completed") return "deletion request approved";
    if (sub === "cancelled") return "deletion request cancelled";
  }

  if (action === "UPDATE_SPONSORSHIP") {
    const sub = payload.action;
    if (sub === "create_period") {
      const amount = payload.amount;
      const days = payload.durationDays;
      if (amount != null && days != null) {
        return `Created sponsorship · $${amount} USDT · ${days} days`;
      }
    }
    if (typeof payload.action === "string") return String(payload.action);
  }

  if (action === "RELEASE_WITHDRAWAL_ALLOWANCE") {
    const amount =
      payload.amount != null ? `+${String(payload.amount)} USDT withdrawable` : null;
    const note =
      typeof payload.note === "string" && payload.note.trim()
        ? payload.note.trim()
        : null;
    return [amount, note ? `note: ${note}` : null].filter(Boolean).join(" · ");
  }

  if (payload.withdrawalId != null) {
    const status = String(payload.status ?? "UNKNOWN");
    const txHash =
      typeof payload.txHash === "string" ? payload.txHash.trim() : "";
    const automatic = payload.automatic === true;
    const parts = [
      automatic ? "Paid automatically" : "Withdrawal updated",
      status,
      txHash
        ? `tx ${shortenHash(txHash)}`
        : status === "CONFIRMED" || status === "SENT"
          ? "no on-chain tx"
          : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }

  if (typeof payload.note === "string" && payload.note.trim()) {
    return payload.note.trim();
  }

  if (typeof payload.delta === "number") {
    const sign = payload.delta >= 0 ? "+" : "";
    return `${sign}${payload.delta} USDT`;
  }

  if (action === "UPSERT_IB_AGREEMENT") {
    const parts: string[] = [];
    if (payload.isIb === true) parts.push("IB");
    if (payload.netDepositEnabled === true) {
      const l1 =
        typeof payload.level1DepositBps === "number"
          ? payload.level1DepositBps / 100
          : null;
      const l2 =
        typeof payload.level2DepositBps === "number"
          ? payload.level2DepositBps / 100
          : null;
      parts.push(
        `Net Deposit L1 ${l1 != null ? `${l1}%` : "?"}${
          l2 && l2 > 0 ? ` · L2 ${l2}%` : " · L1 only"
        }`,
      );
    } else if (payload.netDepositEnabled === false) {
      parts.push("Net Deposit off");
    }
    if (typeof payload.notes === "string" && payload.notes.trim()) {
      parts.push(payload.notes.trim());
    }
    return parts.join(" · ") || "IB agreement updated";
  }

  if (action === "IB_NET_DEPOSIT_CREDIT" && payload.creditedAmount != null) {
    const level = payload.level != null ? `L${String(payload.level)}` : "";
    const rate =
      typeof payload.rateBps === "number" ? `${payload.rateBps / 100}%` : "";
    return `+${String(payload.creditedAmount)} USDT${level ? ` · ${level}` : ""}${
      rate ? ` · ${rate}` : ""
    }`;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return String(action);
  }
}

export function auditDetailMissingOnChainTx(detail: string): boolean {
  return detail.includes("no on-chain tx");
}

export function localizeAuditDetail(
  detail: string,
  t: (key: string) => string,
): string {
  return detail
    .replace(/\bno on-chain tx\b/g, t("admin.audit.noOnChainTx"))
    .replace(/ · auto(?= ·|$)/g, ` · ${t("admin.audit.autoPayoutTag")}`);
}
