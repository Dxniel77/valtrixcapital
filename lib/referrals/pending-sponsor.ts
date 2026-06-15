const PENDING_REF_KEY = "valtrix.pendingRef";

export function setPendingReferralCode(code: string): void {
  if (typeof window === "undefined") return;
  const normalized = code.trim();
  if (!normalized) return;
  sessionStorage.setItem(PENDING_REF_KEY, normalized);
}

export function getPendingReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PENDING_REF_KEY);
}

export function clearPendingReferralCode(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_REF_KEY);
}
