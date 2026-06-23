import { shortenHash } from "@/lib/utils";

export function formatAuditPayload(
  action: string,
  payload: Record<string, unknown> | null,
): string {
  if (!payload) return "";

  if (typeof payload.note === "string" && payload.note.trim()) {
    return payload.note.trim();
  }

  if (typeof payload.delta === "number") {
    const sign = payload.delta >= 0 ? "+" : "";
    return `${sign}${payload.delta} USDT`;
  }

  if (payload.withdrawalId != null) {
    const status = String(payload.status ?? "UNKNOWN");
    const txHash =
      typeof payload.txHash === "string" ? payload.txHash.trim() : "";
    const id = String(payload.withdrawalId).slice(0, 8);
    const automatic = payload.automatic === true;
    const parts = [
      `#${id}`,
      status,
      automatic ? "auto" : null,
      txHash ? shortenHash(txHash) : status === "CONFIRMED" || status === "SENT"
        ? "no on-chain tx"
        : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }

  if (action === "ADJUST_BALANCE" && payload.target) {
    return String(payload.target);
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
